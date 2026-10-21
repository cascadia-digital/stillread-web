# Download counter

A Cloudflare Worker in front of `downloads.stillread.app`. It serves files from R2
with the same headers as before (Range requests, ETag, 304s, the cache-control set
at upload), and counts each `.dmg` download in a D1 table: one running total per
day, file and source.

A count records only the day, the file name and the source: `download` from a browser,
or `update` from Sparkle. It stores no IP addresses, user agents or locations.
HEAD requests, 304s, later chunks of a split download, errors and obvious bots
and link previews aren't counted.

## Test

    npm install
    npm test                  # counting rules, with a stand-in bucket
    npm run dev               # local Worker and local R2 on http://localhost:8787

## Deploy

    npx wrangler login        # once, in the browser
    npx wrangler d1 migrations apply stillread-downloads --remote   # new tables, if any
    npm run deploy

Deploying attaches the route in `wrangler.jsonc`. To undo, remove the route or run
`npx wrangler delete`; downloads then come straight from R2 again.

## Read the counts

With the same wrangler login:

    ./counts.sh          # last 30 days, by day, source and file, plus totals
    ./counts.sh 7
