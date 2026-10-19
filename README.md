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

## Later

- `/changelog`: add `src/pages/changelog.astro` and list it in `src/pages/sitemap.xml.ts`.
- Sparkle's feed goes at `public/appcast.xml`; `netlify.toml` already sets its headers.

Screenshots in `src/assets/shots/` are taken from the app with sample notes; Astro converts them to AVIF and WebP at build time.
