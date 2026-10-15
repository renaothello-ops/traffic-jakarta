# Firebase Auth & Security Setup

## Google Sign-In (manual Console steps)

1. **Firebase Console → Authentication → Sign-in method → Google → Enable**
2. **Authentication → Settings → Authorized domains**
   - Add your production domain (e.g. `your-app.vercel.app`)
   - `localhost` is allowed by default for development
3. Copy Firebase web config into `.env` (see `.env.example`)

## App Check (reCAPTCHA Enterprise) — prepare only

1. **Firebase Console → App Check → Register app → reCAPTCHA Enterprise**
2. Create a reCAPTCHA Enterprise key for your web domains
3. Set in `.env`:
   - `VITE_FIREBASE_APP_CHECK_ENABLED=true`
   - `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=...`
4. For local dev, register a **debug token** (Console → App Check → Manage debug tokens)
5. **Do NOT enable Firestore enforcement** until sign-in and writes succeed with App Check tokens

## Firestore Security Rules

Review `firestore.rules.proposed` before deploying.

Deploy manually when ready:

```bash
firebase deploy --only firestore:rules
```

## Architecture notes

- **MapLibre** = in-app map rendering (unchanged)
- **TomTom** = traffic tiles via `/api/tomtom-flow.png` server proxy
- **Google Places** (future) = destination search via server-side proxy, not client API key
- **Open in Google Maps / Waze** = external deep links only (`navigationLinks.ts`)
