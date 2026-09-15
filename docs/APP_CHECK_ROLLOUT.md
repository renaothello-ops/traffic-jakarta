# Firebase App Check Rollout Plan (Traffic Jakarta)

**Status:** Prepared — enforcement is NOT enabled in code or Console by this document alone.

## Current code state

- Optional initialization in `src/assets/lib/firebase.ts`
- Controlled by `VITE_FIREBASE_APP_CHECK_ENABLED=true`
- Requires `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`
- Debug tokens supported in local development only

## Phase A — Configure (no enforcement)

1. Firebase Console → **App Check** → register the **Web** app.
2. Provider: **reCAPTCHA Enterprise** (recommended for production web).
3. Add the site key to Vercel/local env as `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
4. Set `VITE_FIREBASE_APP_CHECK_ENABLED=true` in staging first.
5. Register **debug tokens** for local dev machines (Console → App Check → Manage debug tokens).

## Phase B — Monitor

1. Keep Firestore **App Check enforcement OFF**.
2. Monitor App Check metrics in Firebase Console for 1–2 weeks.
3. Verify legitimate flows: Google sign-in, post create, vote, comment, community roads.
4. Watch for blocked requests before enabling enforcement.

## Phase C — Enforce Firestore

1. Firebase Console → App Check → **Firestore** → Enable enforcement.
2. Confirm map feed, posting, voting, and comments still work in production.
3. Roll back enforcement immediately if legitimate users are blocked.

## Phase D — Protect custom `/api/*` routes (future)

After Firestore enforcement is stable:

1. Verify App Check tokens on server routes (`/api/places`, `/api/tomtom-route`).
2. Do **not** require App Check on `/api/tomtom-flow.png` tile traffic unless CDN/browser token forwarding is solved — tiles are high-volume and unauthenticated today.
3. Prefer Vercel middleware + Firebase Admin App Check verification for POST `/api/places`.

## Do NOT

- Enable enforcement in this rollout until Phase B metrics look healthy.
- Put reCAPTCHA secret keys in frontend code (site key only is public by design).
- Block TomTom tile loading with strict App Check before testing map traffic volume.
