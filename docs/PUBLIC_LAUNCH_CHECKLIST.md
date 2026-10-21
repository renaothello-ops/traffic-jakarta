# Traffic Jakarta — public launch checklist

Branch audited: `release/traffic-jakarta-public-prep` (update commit SHA after each release prep pass).

This document is for **owner-operated** steps. Agents must **not** deploy production Firebase Rules or merge to `main` without explicit approval.

---

## 1. Firebase Rules (code vs Console)

| Asset | Repo file | Production deploy |
|-------|-----------|-------------------|
| Firestore | `firestore.rules` | **Unverified in Console** — compare tab with repo and Publish |
| Storage | `storage.rules` | **Unverified in Console** — required for post/profile/chat photos |

### Firestore deploy (when approved)

```bash
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Verify in Console → Firestore → Rules. Run locally:

```bash
npm run test:rules
```

### Storage deploy (when Blaze / Storage enabled)

```bash
firebase deploy --only storage --project YOUR_PROJECT_ID
```

Static audit (no emulator):

```bash
npm run test:storage-rules
```

---

## 2. Security model (repo audit summary)

- **`users/{uid}`**: read/write **owner only**.
- **`publicProfiles`**: world-readable; counters not client-writable.
- **`posts`**: read gated by `audience` (public / owner / approved follower); feed query uses `where("audience","==","public")`.
- **`conversations` / `messages`**: members only; no message update/delete.
- **`blocks` / `userReports`**: reporter-scoped read; reports create-only for signed-in users.
- **Storage `postPhotos` / `profilePhotos`**: world **read** (product choice); write **uid match** only. **Chat photos** read/write require conversation membership.

**Not verified on production:** whether Console rules match this repo.

---

## 3. Secrets & client exposure

| Item | Status in repo |
|------|----------------|
| `VITE_FIREBASE_*` | Expected in client bundle (Firebase web SDK). Restrict API key in Google Cloud Console (HTTP referrer / app check). |
| `TOMTOM_API_KEY`, `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY` | Server-only (`api/*`, `server/envSecrets`). **Not** in `VITE_*`. |
| `/api/health` | Production response is `{ ok, handler }` only (no secret flags). Preview/dev may include `secretsConfigured` booleans. |

**Unverified:** Vercel env vars, Google Cloud key restrictions, git history for accidental commits.

---

## 4. Vercel Preview / Production

Set for **Preview** and **Production** (owner verification required):

- All `VITE_FIREBASE_*` from Firebase Console → Web app
- `VITE_PUBLIC_SITE_URL` (canonical URL, no trailing slash)
- Server: `TOMTOM_API_KEY`, `GOOGLE_PLACES_API_KEY` (Places search + routing proxies)
- Optional: `OPENAI_API_KEY` (report text analysis fallback exists without it)
- Until Storage is live: `VITE_POST_PHOTOS_ENABLED=false` (hides photo UI; text posts work)

### Firebase Auth authorized domains

In Firebase Console → Authentication → Settings → Authorized domains, add:

- `localhost` (dev)
- `*.vercel.app` preview host(s) or specific preview domain
- Production custom domain when known

**Unverified:** current Preview URL and Auth domain whitelist.

---

## 5. Legal & trust (product)

- Static drafts: `public/legal/terms.html`, `public/legal/privacy.html` — **OWNER REVIEW REQUIRED** banners.
- In-app onboarding records draft acknowledgment (`onboarding.legalDraftNotice`).
- Report flow: `userReports` collection; block: `blocks/{uid}/blocked`.
- Account deletion: Profile → delete (anonymizes owned posts batch, removes user doc, `deleteUser`).

**Unverified:** legal sign-off, moderation ops, GDPR/export if required for target markets.

---

## 6. Pre-merge smoke (manual)

On Preview, signed-in and signed-out:

1. Google sign-in / sign-out
2. Onboarding + language
3. Public text post (no photo if Storage disabled)
4. Comment / vote
5. Follow / DM (second test account)
6. Block / report UI
7. Map search (Places), route preview, start navigation (voice optional)
8. Profile edit, delete account (test account only)

---

## 7. Automated tests (CI-local)

```bash
npm run build
npm run test:storage-rules
npm run test:rules          # requires Java + Firebase emulators
node --test tests/navigation-speech.test.mjs tests/map-tools-rail.test.mjs tests/post-photo-upload.test.mjs
```

`npm run test:i18n-coverage` — many locales still share English copy (non-blocking for id/en/ja if spot-checked).
