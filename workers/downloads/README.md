# Download counter

A Cloudflare Worker in front of `downloads.stillread.app`. It serves files from R2
with the same headers as before (Range requests, ETag, 304s, the cache-control set
at upload), and counts each `.dmg` download in Workers Analytics Engine.

Each count records only the file name and its source: `download` from a browser,
or `update` from Sparkle. It stores no IP addresses, user agents or locations.
HEAD requests, 304s, later chunks of a split download, errors and obvious bots
and link previews aren't counted.

Analytics Engine keeps data for three months.

## Test

    npm install
    npm test                  # counting rules, with a stand-in bucket
    npm run dev               # local Worker and local R2 on http://localhost:8787

## Deploy

    npx wrangler login        # once, in the browser
    npm run deploy

Deploying attaches the route in `wrangler.jsonc`. To undo, remove the route or run
`npx wrangler delete`; downloads then come straight from R2 again.

## Read the counts

Create a Cloudflare API token with only **Account → Account Analytics → Read**, then
make `~/.config/stillread/cloudflare.env` (chmod 600, never committed):

    CF_ACCOUNT_ID=...
    CF_ANALYTICS_TOKEN=...

Then run:

    ./counts.sh          # last 30 days, by day, file and source
    ./counts.sh 7
