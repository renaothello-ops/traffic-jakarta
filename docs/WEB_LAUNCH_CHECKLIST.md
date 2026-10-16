# Traffic Jakarta — Web launch checklist (do not deploy until verified)

Project ID (from `.env`): `traffic-jakarta` (confirm locally).

## Build & Hosting

```bash
npm run build
firebase deploy --only hosting --project traffic-jakarta
firebase deploy --only firestore:rules,firestore:indexes,storage --project traffic-jakarta
```

Hosting: `firebase.json` → `public: dist`, SPA rewrite to `/index.html`.

## Before public URL

- [ ] Firestore rules + indexes + storage rules deployed and indexes **Enabled**
- [ ] Firebase Auth authorized domains include hosting URL
- [ ] Storage bucket configured; profile + chat photo uploads tested
- [ ] `VITE_*` Firebase keys are **restricted** in Google Cloud Console (HTTP referrer)
- [ ] `TOMTOM_API_KEY`, `GOOGLE_PLACES_API_KEY` server-side only (Vercel/Cloud Functions or Firebase Functions if used)
- [ ] TomTom / Google license terms reviewed for public web traffic
- [ ] App Check (optional) configured if enforcement enabled

## Functional smoke (signed-in)

- [ ] Map loads, TomTom traffic visible, no red Firestore banner
- [ ] Community feed + comments
- [ ] Messages open/close 10× (no INTERNAL ASSERTION)
- [ ] Language switch (all 20) — no page reload, map position preserved
- [ ] Arabic UI RTL; map still pans correctly
- [ ] Mobile Safari safe areas + keyboard on message input

## i18n

- [ ] `npm run test:profile` (includes `i18n-parity.test.mjs`)
- [ ] Re-run `node scripts/i18n-translate-locales.mjs` after en.json changes
- [ ] Native speaker review for id/en/ja + major markets (BLOCKER if machine-only)

## Known blockers until resolved

- Firestore rules/indexes not deployed → Messages / community errors
- Java missing locally → `npm run test:rules` emulator tests not run
- Machine-translated locales may need human QA before marketing launch
