# stillread.app

The website for [Stillread](https://stillread.app), a calm Markdown reader for the Mac. Astro + Tailwind, deployed on Netlify.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Switches

Everything that changes at launch lives in `src/config.ts`:

- `downloadUrl`: the notarized download. Empty shows "Coming soon".
- `checkoutUrl`: the Polar checkout link for Editing. Empty shows "Coming soon".
- `supportEmail`: shown (lightly obfuscated) on every page.
- `fathomSite`: Fathom site ID. Empty keeps analytics off.

## Deploy and DNS

- Hosting: Netlify, building from this repo (settings come from `netlify.toml`).
- Domain: registered at Hover; DNS is on Cloudflare.
- Cloudflare records, all **DNS only (grey cloud), never proxied**, so Netlify can issue and renew HTTPS:
  - `A` · `stillread.app` → `75.2.60.5` (Netlify's load balancer)
  - `CNAME` · `www` → `<site-name>.netlify.app`
- In Netlify, add both `stillread.app` and `www.stillread.app` under Domain management, make `stillread.app` primary, then verify DNS under HTTPS.

## Later

- `/changelog`: add `src/pages/changelog.astro` and list it in `src/pages/sitemap.xml.ts`.
- Sparkle's feed goes at `public/appcast.xml`; `netlify.toml` already sets its headers.

Screenshots in `src/assets/shots/` are taken from the app with sample notes; Astro converts them to AVIF and WebP at build time.
