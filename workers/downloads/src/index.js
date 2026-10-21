// Serves downloads.stillread.app from R2 (as the bucket's own domain did) and counts
// each .dmg download.
//
// Counts live in a D1 table, one row per day, file and source (a browser, or
// Sparkle, the in-app updater), each holding a running total.
// Nothing about the visitor is stored: no IP, no user agent, no location.
//
// Not counted: HEAD requests, conditional requests answered with 304,
// later chunks of a resumed or split download (a Range that doesn't start at
// byte 0), errors, and obvious bots and link previews.

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl|wget|python|httpie|go-http|java\/|okhttp|headless|lighthouse|pingdom|uptime|monitor/i;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        let key;
        try { key = decodeURIComponent(url.pathname.slice(1)); } catch (_) { key = ''; }
        if (!key) return new Response('Not found', { status: 404 });

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
        }

        const response = await serve(request, env.BUCKET, key);
        if (key.endsWith('.dmg') && shouldCount(request, response)) {
            // Counted in the background, so it never slows the download, and a failure never breaks it.
            ctx.waitUntil(count(env.DB, key, source(request)).catch(() => {}));
        }
        return response;
    },
};

async function serve(request, bucket, key) {
    const head = request.method === 'HEAD';
    const object = head
        ? await bucket.head(key)
        : await bucket.get(key, { range: request.headers, onlyIf: request.headers });
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);          // content-type, cache-control, etc. as uploaded
    headers.set('etag', object.httpEtag);
    headers.set('last-modified', object.uploaded.toUTCString());
    headers.set('accept-ranges', 'bytes');

    // A failed precondition (If-None-Match matched): get() returns the object without a body.
    if (!head && !('body' in object)) return new Response(null, { status: 304, headers });

    const range = !head && object.range;
    if (range && hasRange(request)) {
        const start = range.offset ?? (range.suffix != null ? object.size - range.suffix : 0);
        const length = range.length ?? (range.suffix ?? object.size - start);
        headers.set('content-range', `bytes ${start}-${start + length - 1}/${object.size}`);
        headers.set('content-length', String(length));
        return new Response(object.body, { status: 206, headers });
    }
    headers.set('content-length', String(object.size));
    return new Response(head ? null : object.body, { status: 200, headers });
}

function hasRange(request) {
    return request.headers.has('range');
}

function shouldCount(request, response) {
    if (request.method !== 'GET') return false;
    if (BOT.test(request.headers.get('user-agent') || '')) return false;
    if (response.status === 206) {
        // Count a ranged download once: the request that asks for the first byte.
        return /^bytes=0-/.test(request.headers.get('range') || '');
    }
    return response.status === 200;
}

async function count(db, file, src) {
    const day = new Date().toISOString().slice(0, 10);
    return db.prepare(
        'INSERT INTO downloads (day, file, source, count) VALUES (?1, ?2, ?3, 1) ' +
        'ON CONFLICT (day, file, source) DO UPDATE SET count = count + 1'
    ).bind(day, file, src).run();
}

function source(request) {
    return /Sparkle/i.test(request.headers.get('user-agent') || '') ? 'update' : 'download';
}
