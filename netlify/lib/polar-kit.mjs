// Polar "order.paid" webhook -> tag the buyer in Kit, so Stillread sales emails can leave buyers out.
// Buying isn't consent to marketing email, so we only tag people who are already Kit subscribers.
// No dependencies: Standard Webhooks verification is done with node:crypto.
import { createHmac, timingSafeEqual } from 'node:crypto';

const KIT_API = 'https://api.kit.com/v4';
const DEFAULT_TAG_ID = '26501163'; // "Stillread: editing purchased"
const TOLERANCE_SECONDS = 5 * 60;  // reject signatures older or newer than this
const KIT_TIMEOUT_MS = 4000;       // Polar gives us 10 seconds in total

/** "michael@example.com" -> "m***@example.com". Logs never get a full address. */
export function maskEmail(email) {
    const at = String(email).lastIndexOf('@');
    if (at < 1) return '***';
    return email[0] + '***' + email.slice(at);
}

/**
 * The HMAC keys to try for a Polar secret. Secrets made on or after 2026-09-08 follow
 * Standard Webhooks (base64 after "whsec_"); older ones use the UTF-8 bytes of the whole
 * "whsec_..." string. Polar's own SDK tries both, so we do too.
 */
export function signingKeys(secret) {
    const keys = [];
    const b64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const decoded = Buffer.from(b64, 'base64');
    if (decoded.length > 0 && decoded.toString('base64').replace(/=+$/, '') === b64.replace(/=+$/, '')) keys.push(decoded);
    keys.push(Buffer.from(secret, 'utf8'));
    return keys;
}

/** Returns true only if one of the webhook-signature entries matches and the timestamp is fresh. */
export function verifySignature({ id, timestamp, signature, body, secret, now = Date.now() }) {
    if (!id || !timestamp || !signature || !secret) return false;
    if (!/^\d+$/.test(timestamp)) return false;
    if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > TOLERANCE_SECONDS) return false;

    const signed = `${id}.${timestamp}.${body}`;
    const given = signature.split(' ')
        .map(part => part.split(','))
        .filter(([version, sig]) => version === 'v1' && sig)
        .map(([, sig]) => Buffer.from(sig, 'base64'));

    for (const key of signingKeys(secret)) {
        const expected = createHmac('sha256', key).update(signed).digest();
        if (given.some(sig => sig.length === expected.length && timingSafeEqual(sig, expected))) return true;
    }
    return false;
}

const reply = (status, message) => new Response(message, { status, headers: { 'content-type': 'text/plain' } });

/** Builds the handler. Tests pass their own env, fetch and clock; Netlify uses the real ones. */
export function createHandler({ env = process.env, fetch = globalThis.fetch, now = () => Date.now(), log = console } = {}) {
    return async function handler(req) {
        if (req.method !== 'POST') return reply(405, 'Method not allowed');

        const secret = env.POLAR_WEBHOOK_SECRET;
        const apiKey = env.KIT_API_KEY;
        const tagId = env.KIT_STILLREAD_BUYER_TAG_ID || DEFAULT_TAG_ID;
        if (!secret || !apiKey) {
            log.error('polar-webhook: POLAR_WEBHOOK_SECRET or KIT_API_KEY is not set');
            return reply(500, 'Not configured');
        }

        const body = await req.text(); // raw body: the signature covers these exact bytes
        const ok = verifySignature({
            id: req.headers.get('webhook-id'),
            timestamp: req.headers.get('webhook-timestamp'),
            signature: req.headers.get('webhook-signature'),
            body, secret, now: now(),
        });
        if (!ok) {
            log.warn('polar-webhook: rejected a request with a missing, invalid or stale signature');
            return reply(401, 'Invalid signature');
        }

        let event;
        try { event = JSON.parse(body); } catch { return reply(400, 'Invalid JSON'); }

        if (event?.type !== 'order.paid') return reply(200, `Ignored ${event?.type ?? 'unknown event'}`);

        const orderId = event.data?.id ?? 'unknown';
        const email = event.data?.customer?.email;
        if (!email) {
            log.warn(`polar-webhook: order ${orderId} has no customer email, nothing to tag`);
            return reply(200, 'No email');
        }
        const who = maskEmail(email);
        const kit = (path, init = {}) => fetch(KIT_API + path, {
            ...init,
            headers: { 'X-Kit-Api-Key': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(KIT_TIMEOUT_MS),
        });

        try {
            // Default status is "active", which is who sales emails go to.
            const found = await kit(`/subscribers?email_address=${encodeURIComponent(email)}`);
            if (!found.ok) {
                log.error(`polar-webhook: Kit lookup failed with ${found.status} for order ${orderId}`);
                return reply(502, 'Kit lookup failed'); // non-2xx so Polar retries
            }
            const subscriber = (await found.json())?.subscribers?.[0];
            if (!subscriber) {
                log.info(`polar-webhook: ${who} (order ${orderId}) is not a Kit subscriber, not adding them`);
                return reply(200, 'Not a subscriber');
            }

            const tagged = await kit(`/tags/${encodeURIComponent(tagId)}/subscribers/${subscriber.id}`, { method: 'POST', body: '{}' });
            if (tagged.status === 404) {
                log.warn(`polar-webhook: Kit returned 404 tagging ${who} (order ${orderId}); check KIT_STILLREAD_BUYER_TAG_ID`);
                return reply(502, 'Kit tag failed');
            }
            if (!tagged.ok) {
                log.error(`polar-webhook: Kit tagging failed with ${tagged.status} for order ${orderId}`);
                return reply(502, 'Kit tag failed');
            }
            // 201 = newly tagged, 200 = already had the tag (a Polar retry). Both are fine.
            log.info(`polar-webhook: tagged ${who} (order ${orderId}, Kit ${tagged.status})`);
            return reply(200, 'Tagged');
        } catch (err) {
            log.error(`polar-webhook: could not reach Kit for order ${orderId}: ${err?.name ?? 'Error'}`);
            return reply(502, 'Kit unreachable');
        }
    };
}
