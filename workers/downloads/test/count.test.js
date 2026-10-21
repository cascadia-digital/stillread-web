// Which requests count as a download. Uses a stand-in bucket; test/live.sh checks real R2 behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const SIZE = 1000;
function bucket() {
    const meta = (extra = {}) => ({
        size: SIZE, httpEtag: '"abc"', uploaded: new Date('2026-10-20T23:03:21Z'),
        writeHttpMetadata(h) { h.set('content-type', 'application/x-apple-diskimage'); h.set('cache-control', 'public, max-age=300'); },
        ...extra,
    });
    return {
        async head(key) { return key.startsWith('Stillread') ? meta() : null; },
        async get(key, { range }) {
            if (!key.startsWith('Stillread')) return null;
            if (range.get('if-none-match') === '"abc"') return meta();          // no body: precondition failed
            const r = /bytes=(\d+)-(\d*)/.exec(range.get('range') || '');
            const offset = r ? Number(r[1]) : 0, length = r ? (r[2] ? Number(r[2]) - offset + 1 : SIZE - offset) : SIZE;
            return meta({ body: new Uint8Array(length), range: r ? { offset, length } : undefined });
        },
    };
}
async function run(path, { method = 'GET', headers = {} } = {}) {
    const points = [];
    const env = { BUCKET: bucket(), DOWNLOADS: { writeDataPoint: p => points.push(p) } };
    const res = await worker.fetch(new Request('https://downloads.stillread.app' + path, { method, headers }), env, {});
    return { res, points };
}
const safari = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15' };

test('a browser download counts once, with no visitor details', async () => {
    const { res, points } = await run('/Stillread.dmg', { headers: safari });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-length'), String(SIZE));
    assert.deepEqual(points, [{ indexes: ['Stillread.dmg'], blobs: ['Stillread.dmg', 'download'], doubles: [1] }]);
});

test('a Sparkle update is labelled as an update', async () => {
    const { points } = await run('/Stillread-1.0.3.dmg', { headers: { 'user-agent': 'Stillread/1.0.2 Sparkle/2.8.0' } });
    assert.deepEqual(points[0].blobs, ['Stillread-1.0.3.dmg', 'update']);
});

test('a ranged download counts only for the first chunk', async () => {
    const first = await run('/Stillread.dmg', { headers: { ...safari, range: 'bytes=0-99' } });
    assert.equal(first.res.status, 206);
    assert.equal(first.res.headers.get('content-range'), `bytes 0-99/${SIZE}`);
    assert.equal(first.points.length, 1);
    const later = await run('/Stillread.dmg', { headers: { ...safari, range: 'bytes=100-' } });
    assert.equal(later.res.status, 206);
    assert.equal(later.res.headers.get('content-range'), `bytes 100-999/${SIZE}`);
    assert.equal(later.points.length, 0);
});

test('HEAD, 304, missing files, bots and other files are not counted', async () => {
    for (const [path, opts, status] of [
        ['/Stillread.dmg', { method: 'HEAD', headers: safari }, 200],
        ['/Stillread.dmg', { headers: { ...safari, 'if-none-match': '"abc"' } }, 304],
        ['/Nope.dmg', { headers: safari }, 404],
        ['/Stillread.dmg', { headers: { 'user-agent': 'Twitterbot/1.0' } }, 200],
        ['/Stillread.dmg', { headers: { 'user-agent': 'curl/8.7.1' } }, 200],
        ['/Stillread.dmg', { headers: { 'user-agent': 'Slackbot-LinkExpanding 1.0' } }, 200],
    ]) {
        const { res, points } = await run(path, opts);
        assert.equal(res.status, status, path + ' ' + JSON.stringify(opts));
        assert.equal(points.length, 0, path + ' ' + JSON.stringify(opts));
    }
});

test('a failing counter never breaks the download', async () => {
    const env = { BUCKET: bucket(), DOWNLOADS: { writeDataPoint() { throw new Error('down'); } } };
    const res = await worker.fetch(new Request('https://downloads.stillread.app/Stillread.dmg', { headers: safari }), env, {});
    assert.equal(res.status, 200);
});

test('POST is refused', async () => {
    const { res } = await run('/Stillread.dmg', { method: 'POST' });
    assert.equal(res.status, 405);
});
