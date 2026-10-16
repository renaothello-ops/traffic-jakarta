# Public web launch — Traffic Jakarta (prepare only; no auto-deploy)

## Firebase project ID

Confirm in `.env`: **`traffic-jakarta`** (also `.firebaserc` default).

## Expected public URLs (Firebase Hosting defaults)

| URL | Purpose |
|-----|---------|
| `https://traffic-jakarta.web.app` | Primary Hosting URL |
| `https://traffic-jakarta.firebaseapp.com` | Alternate Hosting URL |

Custom domain: add in Firebase Console → Hosting, then set `VITE_PUBLIC_SITE_URL` and re-run `npm run build`.

## Production build

```bash
npm run build   # runs seo:generate → tsc → vite build
firebase deploy --only hosting --project traffic-jakarta
```

## **Launch blocker: `/api/*` on Firebase Hosting**

The SPA calls server routes:

- `/api/tomtom-flow.png`, `/api/tomtom-flow-segment`, `/api/tomtom-route`
- `/api/places`
- `/api/analyze-report` (optional)

These are implemented as **Vite dev middleware** (`vite.config.ts`) and **Vercel-style** files under `api/`. **Firebase Hosting alone serves static files only** — TomTom tiles, routing, and Places search will **not work** after deploy unless you:

1. Deploy `api/` to **Vercel** (or similar) and set Hosting rewrites to that origin, **or**
2. Add **Firebase Cloud Functions / Cloud Run** proxies with the same paths and secrets (`TOMTOM_API_KEY`, `GOOGLE_PLACES_API_KEY`), **or**
3. Host the full stack on Vercel with `api/` routes + static `dist/`.

Do **not** expose TomTom or Google keys in `VITE_*` client env vars.

## Firestore / Storage / Auth (manual deploy)

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes,storage --project traffic-jakarta
```

Wait for indexes **Enabled** in Console. Rules tests locally:

```bash
npm run test:rules   # requires Java + Firebase CLI login
```

## Google Sign-In (Firebase Console)

1. Authentication → Sign-in method → Google → Enabled.
2. Authentication → **Settings → Authorized domains** → add:
   - `traffic-jakarta.web.app`
   - `traffic-jakarta.firebaseapp.com`
   - Your custom domain (if any)
3. Google Cloud Console → APIs & Services → **OAuth consent screen** → authorized domains.
4. Restrict **Firebase Web API key** (HTTP referrers) to your production hostnames.

## Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console).
2. Add property: URL prefix `https://traffic-jakarta.web.app` (or domain property).
3. Verify via existing meta tag in `index.html` (`google-site-verification`) or DNS/HTML file.
4. Submit sitemap: `https://traffic-jakarta.web.app/sitemap.xml`
5. URL Inspection → request indexing for `/` and `/home.html`.
6. Monitor Coverage / Page indexing; expect SPA routes to index mainly via static landing pages.

## SEO assets (generated at build)

- `public/robots.txt`, `public/sitemap.xml` via `npm run seo:generate`
- Static landings: `/home.html`, `/home-id.html`
- In-app overlay landing on `/` (hidden after “Open Traffic Map” or return visit via `localStorage`)

## Legal

Draft pages under `/legal/` — **OWNER REVIEW REQUIRED** before treating as final policy.
