// The Polar -> Kit webhook, with a made-up secret and a stand-in for Kit's API. Nothing real is called.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createHandler, maskEmail, verifySignature } from '../lib/polar-kit.mjs';

const SECRET = 'whsec_' + randomBytes(24).toString('base64'); // test-only, generated per run
const ENDPOINT = 'https://stillread.app/.netlify/functions/polar-webhook';
const NOW = Date.UTC(2026, 10, 27, 18, 0, 0);

function sign(body, { secret = SECRET, id = 'msg_test_1', ts = Math.floor(NOW / 1000), legacy = false } = {}) {
    const key = legacy ? Buffer.from(secret, 'utf8') : Buffer.from(secret.slice(6), 'base64');
    const sig = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
    return { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}`, 'content-type': 'application/json' };
}

const paid = (email = 'reader@example.com') => JSON.stringify({
    type: 'order.paid', timestamp: '2026-11-27T18:00:00Z', api_version: '2026-10',
    data: { id: 'ord_123', status: 'paid', paid: true, customer: { id: 'cus_1', email } },
});

// A stand-in Kit: knows one subscriber, remembers which tags it has.
function fakeKit({ subscribers = { 'reader@example.com': 42 }, status } = {}) {
    const calls = [], tags = new Set();
    const fetch = async (url, init = {}) => {
        const u = new URL(url), method = init.method ?? 'GET';
        calls.push({ method, path: u.pathname, key: init.headers?.['X-Kit-Api-Key'] });
        if (status) return new Response('{}', { status });
        if (method === 'GET' && u.pathname === '/v4/subscribers') {
            const id = subscribers[u.searchParams.get('email_address')];
            return Response.json({ subscribers: id ? [{ id, email_address: u.searchParams.get('email_address'), state: 'active' }] : [] });
        }
        const m = u.pathname.match(/^\/v4\/tags\/(\d+)\/subscribers\/(\d+)$/);
        if (method === 'POST' && m) {
            const k = m.join(':'), had = tags.has(k);
            tags.add(k);
            return Response.json({ subscriber: { id: Number(m[2]) } }, { status: had ? 200 : 201 });
        }
        return new Response('not found', { status: 404 });
    };
    return { fetch, calls };
}

function setup(kitOptions, env = {}) {
    const kit = fakeKit(kitOptions), lines = [];
    const log = { info: m => lines.push(m), warn: m => lines.push(m), error: m => lines.push(m) };
    const handler = createHandler({ env: { POLAR_WEBHOOK_SECRET: SECRET, KIT_API_KEY: 'kit_test_key', ...env }, fetch: kit.fetch, now: () => NOW, log });
    const post = (body, headers) => handler(new Request(ENDPOINT, { method: 'POST', body, headers }));
    return { post, kit, lines };
}

test('a bad signature gets 401 and Kit is never called', async () => {
    const { post, kit } = setup();
    const body = paid();
    const res = await post(body, sign(body, { secret: 'whsec_' + randomBytes(24).toString('base64') }));
    assert.equal(res.status, 401);
    assert.equal(kit.calls.length, 0);
});

test('a tampered body gets 401', async () => {
    const { post } = setup();
    const res = await post(paid('someone-else@example.com'), sign(paid()));
    assert.equal(res.status, 401);
});

test('missing signature headers get 401', async () => {
    const { post } = setup();
    assert.equal((await post(paid(), { 'content-type': 'application/json' })).status, 401);
});

test('a stale timestamp gets 401 even with a valid signature', async () => {
    const { post } = setup();
    const body = paid();
    const res = await post(body, sign(body, { ts: Math.floor(NOW / 1000) - 10 * 60 }));
    assert.equal(res.status, 401);
});

test('an existing subscriber gets the buyer tag', async () => {
    const { post, kit, lines } = setup();
    const body = paid();
    const res = await post(body, sign(body));
    assert.equal(res.status, 200);
    assert.deepEqual(kit.calls.map(c => `${c.method} ${c.path}`), ['GET /v4/subscribers', 'POST /v4/tags/26501163/subscribers/42']);
    assert.ok(kit.calls.every(c => c.key === 'kit_test_key'));
    assert.ok(lines.some(l => l.includes('r***@example.com')));
    assert.ok(!lines.join('\n').includes('reader@example.com'), 'full email must not be logged');
});

test('a Polar retry of the same order is harmless (Kit says 200, we say 200)', async () => {
    const { post, kit } = setup();
    const body = paid();
    assert.equal((await post(body, sign(body))).status, 200);
    assert.equal((await post(body, sign(body))).status, 200);
    assert.equal(kit.calls.filter(c => c.method === 'POST').length, 2);
});

test('an email that is not in Kit gets 200 and is not created', async () => {
    const { post, kit, lines } = setup();
    const body = paid('stranger@example.com');
    const res = await post(body, sign(body));
    assert.equal(res.status, 200);
    assert.deepEqual(kit.calls.map(c => `${c.method} ${c.path}`), ['GET /v4/subscribers']);
    assert.ok(!lines.join('\n').includes('stranger@example.com'));
});

test('other event types get 200 and Kit is never called', async () => {
    const { post, kit } = setup();
    const body = JSON.stringify({ type: 'order.created', data: { id: 'ord_123', customer: { email: 'reader@example.com' } } });
    const res = await post(body, sign(body));
    assert.equal(res.status, 200);
    assert.equal(kit.calls.length, 0);
});

test('a Kit server error returns non-2xx so Polar retries', async () => {
    const { post } = setup({ status: 503 });
    const body = paid();
    assert.equal((await post(body, sign(body))).status, 502);
});

test('Kit being unreachable returns non-2xx so Polar retries', async () => {
    const lines = [];
    const log = { info: m => lines.push(m), warn: m => lines.push(m), error: m => lines.push(m) };
    const handler = createHandler({
        env: { POLAR_WEBHOOK_SECRET: SECRET, KIT_API_KEY: 'k' }, now: () => NOW, log,
        fetch: async () => { throw new TypeError('fetch failed'); },
    });
    const body = paid();
    const res = await handler(new Request(ENDPOINT, { method: 'POST', body, headers: sign(body) }));
    assert.equal(res.status, 502);
});

test('the tag id can come from KIT_STILLREAD_BUYER_TAG_ID', async () => {
    const { post, kit } = setup({}, { KIT_STILLREAD_BUYER_TAG_ID: '999' });
    const body = paid();
    await post(body, sign(body));
    assert.equal(kit.calls[1].path, '/v4/tags/999/subscribers/42');
});

test('older Polar secrets (raw whsec_ string as the key) still verify', async () => {
    const { post } = setup();
    const body = paid();
    assert.equal((await post(body, sign(body, { legacy: true }))).status, 200);
});

test('missing configuration returns 500, never 2xx', async () => {
    const handler = createHandler({ env: {}, fetch: async () => { throw new Error('should not call'); }, log: { error() {} } });
    const res = await handler(new Request(ENDPOINT, { method: 'POST', body: '{}' }));
    assert.equal(res.status, 500);
});

test('GET is not allowed', async () => {
    const { kit } = setup();
    const handler = createHandler({ env: { POLAR_WEBHOOK_SECRET: SECRET, KIT_API_KEY: 'k' }, fetch: kit.fetch });
    assert.equal((await handler(new Request(ENDPOINT))).status, 405);
});

test('helpers: masking and multiple signatures in one header', () => {
    assert.equal(maskEmail('michael@example.com'), 'm***@example.com');
    assert.equal(maskEmail('nonsense'), '***');
    const body = '{}', h = sign(body);
    const signature = `v1,${Buffer.alloc(32).toString('base64')} ${h['webhook-signature']}`;
    assert.ok(verifySignature({ id: h['webhook-id'], timestamp: h['webhook-timestamp'], signature, body, secret: SECRET, now: NOW }));
});
