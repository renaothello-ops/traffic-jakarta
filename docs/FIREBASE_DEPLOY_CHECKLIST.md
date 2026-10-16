# Firebase deploy checklist (Traffic Jakarta)

Do **not** run until `.env` / `VITE_FIREBASE_PROJECT_ID` matches your Firebase project.

## Determine project ID

- Set in `.env` or `.env.local`: `VITE_FIREBASE_PROJECT_ID=<your-project-id>`
- There is **no** `.firebaserc` in repo; CLI uses `--project` flag.
- Local dev uses **production Firestore** unless you add `connectFirestoreEmulator` (not enabled in app code today).

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
