# Production `/api/*` (Firebase Hosting + Cloud Functions)

## Architecture

- **Firebase Hosting** serves `dist/` (Vite SPA).
- **Rewrite** `/api/**` → Cloud Function **`api`** (`functions/src/index.ts`).
- **Dev**: Vite middleware calls the same `server/apiHttp.ts` router.

## Secrets (never `VITE_*`)

Set in Google Cloud Secret Manager / Firebase Functions secrets:

- `TOMTOM_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- Optional: `OPENAI_API_KEY` for future LLM analyze path

Local dev: `.env.local` (gitignored).

## Deploy (when approved)

```bash
cd functions && npm install && npm run build
firebase deploy --only functions:api,hosting
# Also: firestore:rules, storage:rules, firestore:indexes
```

## Endpoint inventory

| Endpoint | Caller | Upstream | Auth | Notes |
|----------|--------|----------|------|-------|
| `POST /api/places` | `search.ts`, `MapScreen` | Google Places API (New) | No (rate limit) | Validated actions only |
| `GET /api/tomtom-route` | `routing.ts` | TomTom Routing | No (rate limit) | Fixed query params |
| `GET /api/tomtom-flow-segment` | `tomtomAdapter.ts` | TomTom Flow Segment | No (rate limit) | lat/lng bounds |
| `GET /api/tomtom-flow.png` | `useTomTomTrafficLayer`, tiles | TomTom flow tiles | No (rate limit) | z/x/y validated |
| `POST /api/analyze-report` | `analyzeTrafficText.ts` | Rule-based (optional OpenAI) | No (rate limit) | No open proxy |

Unknown `/api/*` → **404 JSON** (no URL passthrough).

## Abuse controls

Implemented in `server/apiSecurity.ts` + `server/apiValidation.ts`:

- Per-IP sliding window rate limits
- Input validation (coordinates, tile indices, place IDs)
- No arbitrary upstream URLs
- Timeouts/size limits on upstream fetch where applicable

## App Check

See [APP_CHECK.md](./APP_CHECK.md) for monitor-then-enforce on Firestore/Storage and optional verification on `api`.
