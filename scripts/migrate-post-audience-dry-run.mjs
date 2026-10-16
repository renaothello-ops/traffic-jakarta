#!/usr/bin/env node
/**
 * Dry-run: list posts missing `audience` (would set audience=public if executed with --apply).
 * Does NOT touch production unless --apply is passed (not implemented here by design).
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
  },
});

console.info("[migrate-post-audience] DRY RUN ONLY — no Firestore writes.");
console.info("Pass --apply is ignored in this script; use Admin SDK job after review.");

if (values.apply) {
  console.warn("Refusing --apply from this script. Run a reviewed Admin migration separately.");
  process.exit(1);
}

console.info(`
Manual steps:
1. Export posts where audience is absent (Firebase Console or gcloud firestore export + query).
2. Batch-update each doc: { audience: "public" } for map-visible legacy reports.
3. Re-run map feed query: where(audience == public) + orderBy(createdAt desc).
`);
