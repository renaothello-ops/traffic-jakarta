# App Check rollout (Traffic Jakarta web)

## Provider

- **reCAPTCHA Enterprise** (site key in `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`).
- Frontend flag: `VITE_FIREBASE_APP_CHECK_ENABLED=true` after monitoring.

## Frontend setup

1. Register the production web app in Firebase Console → App Check → reCAPTCHA Enterprise.
2. Initialize App Check in the client (already gated by env flags in the app).
3. Use the same site key for `traffic-jakarta.web.app` and custom domain if added.

## Services that can be protected

| Service | Enforce when ready |
|---------|-------------------|
| Firestore | Monitor → enforce after error rate stable |
| Storage | Monitor → enforce |
| Cloud Functions `api` | Verify App Check token in function (optional middleware) |

## Custom `/api/*` verification

Cloud Function `api` can read `X-Firebase-AppCheck` and call Admin `appCheck().verifyToken()`. Roll out **after** Hosting rewrites are live and browser App Check is enabled for most sessions.

## Safe rollout

1. **Observe**: enable App Check in Firebase Console in *monitor* mode for Firestore/Storage.
2. Ship frontend with App Check init enabled on production domain only.
3. Watch App Check metrics and auth failures for 1–2 weeks.
4. Switch Firestore/Storage to **enforce**.
5. Optionally enforce on `api` for anonymous-heavy routes (tiles/places).

Do **not** enforce on day one of public launch — avoids locking out users behind blockers or misconfigured keys.
