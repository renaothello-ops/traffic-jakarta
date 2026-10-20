# Firebase deploy checklist (Traffic Jakarta)

Do **not** run until `.env` / `VITE_FIREBASE_PROJECT_ID` matches your Firebase project.

## Determine project ID

- Set in `.env` or `.env.local`: `VITE_FIREBASE_PROJECT_ID=<your-project-id>`
- There is **no** `.firebaserc` in repo; CLI uses `--project` flag.
- Local dev uses **production Firestore** unless you add `connectFirestoreEmulator` (not enabled in app code today).

## Compare deployed rules vs repo (before deploy)

```bash
export FIREBASE_PROJECT_ID="$(grep VITE_FIREBASE_PROJECT_ID .env.local 2>/dev/null | cut -d= -f2- | tr -d '\"')"
export FIREBASE_ACCESS_TOKEN="$(gcloud auth print-access-token)"   # or a firebase login:ci token
node scripts/fetch-deployed-firestore-rules.mjs
diff -u firestore.rules.deployed firestore.rules
```

Release branch target: commit **`2251985`** or later (`firestore.rules` with username reservation + onboarding fields).

## Deploy (in order)

```bash
export PROJECT_ID="$(grep VITE_FIREBASE_PROJECT_ID .env.local 2>/dev/null | cut -d= -f2)"
# or set manually: PROJECT_ID=your-project-id

firebase deploy --only firestore:rules --project "$PROJECT_ID"
firebase deploy --only firestore:indexes --project "$PROJECT_ID"
firebase deploy --only storage --project "$PROJECT_ID"
```

Combined (same effect):

```bash
firebase deploy --only firestore,storage --project "$PROJECT_ID"
```

## Vercel Preview / production (API keys — server-side only)

In Vercel → Project → Settings → Environment Variables (Preview + Production):

| Variable | Required for |
|----------|----------------|
| `TOMTOM_API_KEY` | Map traffic layer, routing |
| `GOOGLE_PLACES_API_KEY` | Place search (`/api/places`; without it clients see “search not configured”) |
| All `VITE_FIREBASE_*` | Google login + Firestore (from Firebase Console) |

Redeploy Preview after changing env vars.

## After deploy

1. Firebase Console → Firestore → Indexes: wait until **Enabled** (not Building).
2. Map tab: community reports load without red banner.
3. Profile → **Messages**: empty state or conversations (no red error).
4. Open/close Messages 10×: no crash.

## Collections used by the client

`users`, `publicProfiles`, `usernames`, `posts` (+ `comments`, `votes`, `ownerSecret`), `communityRoads`, `follows`, `followRequests`, `conversations` (+ `messages`), `userThreads`, `blocks`, `userReports`, `users/{uid}/notifications`, `users/{uid}/favoritePlaces`

## Composite indexes required (see `firestore.indexes.json`)

- `posts`: audience + createdAt (optional; map feed uses `createdAt` + client filter for legacy compatibility)
- `follows`: followerUid + createdAt; followingUid + createdAt
- `conversations`: memberKeys (array) + lastMessageAt; optional pendingForUid + status + lastMessageAt
