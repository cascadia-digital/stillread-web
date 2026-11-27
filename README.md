# stillread.app

The website for [Stillread](https://stillread.app), a calm Markdown reader for the Mac. Astro + Tailwind, deployed on Netlify.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Switches

Everything that changes at launch lives in `src/config.ts`:

- `launched`: the launch switch. While `false`, Download and Buy both show "Coming soon"; set it to `true` to go live.
- `downloadLink`: where the Download buttons point (the notarized DMG).
- `checkoutLink`: the Polar checkout for the Editing unlock.
- `customerPortalUrl`: Polar's customer portal, where buyers find their key and manage their Macs.
- `supportEmail`: shown (lightly obfuscated) on every page.
- `fathomSite`: Fathom site ID. Empty keeps analytics off.

## Hosting

Hosted on Netlify, building from this repo (settings in `netlify.toml`).

## Buyers tagged in Kit

When someone buys the Editing unlock, Polar calls a Netlify Function at `netlify/functions/polar-webhook.mjs` (logic in `netlify/lib/polar-kit.mjs`). It checks Polar's signature, looks the buyer's email up in Kit, and if they're already an active subscriber it adds the tag "Stillread: editing purchased". If they aren't a subscriber it leaves them alone: buying isn't a sign-up. Sales emails can then exclude that tag.

Run the tests with `npm test`. They use a made-up secret and a stand-in for Kit, so nothing real is called.

Setup:

1. In Netlify, under Site configuration, Environment variables, add:
   - `POLAR_WEBHOOK_SECRET`: the endpoint's secret from Polar (starts with `whsec_`). Paste it as-is; the function handles both of Polar's secret formats.
   - `KIT_API_KEY`: a Kit v4 API key (Kit, Settings, Developer).
   - `KIT_STILLREAD_BUYER_TAG_ID` (optional): defaults to 26501163.

   Mark the two keys as secret, and redeploy so the function sees them.
2. In Polar, under Settings, Webhooks, add an endpoint with the URL `https://stillread.app/.netlify/functions/polar-webhook`, format Raw, and subscribe it to `order.paid` only. Copy its secret into step 1.
3. To test, make a 100% off discount code in Polar, subscribe to the Kit list with an email you control, and buy through the real checkout with that code. Check Polar's webhook deliveries (should be 200), the function log in Netlify (Logs, Functions), and the tag on your Kit subscriber. Then refund the order in Polar and delete the discount code.

The function answers 401 for a bad or stale signature, 200 for anything it handled or chose to skip, and 502 when Kit is down, so Polar retries later.

## Later

- `/changelog`: add `src/pages/changelog.astro` and list it in `src/pages/sitemap.xml.ts`.
- Sparkle's feed goes at `public/appcast.xml`; `netlify.toml` already sets its headers.

Screenshots in `src/assets/shots/` are taken from the app with sample notes; Astro converts them to AVIF and WebP at build time.
