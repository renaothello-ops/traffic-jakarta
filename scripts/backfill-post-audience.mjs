#!/usr/bin/env node
/**
 * Optional migration: set audience: "public" on legacy posts missing the field.
 *
 * Does NOT run automatically. Requires Firebase Admin credentials.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   export FIREBASE_PROJECT_ID=your-project-id
 *   node scripts/backfill-post-audience.mjs --dry-run
 *   node scripts/backfill-post-audience.mjs --execute
 *
 * --dry-run   (default) Count and list sample IDs only; no writes.
 * --execute   Batch-update missing audience to "public" (max 500 per run; re-run until 0).
 */

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error(
    "Set FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) to your Firebase project ID."
  );
  process.exit(1);
}

let admin;
try {
  admin = await import("firebase-admin");
} catch {
  console.error(
    "firebase-admin is required for this script. Install: npm install -D firebase-admin"
  );
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();
const BATCH_SIZE = 400;

async function run() {
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY-RUN"}`);

  const snap = await db.collection("posts").orderBy("createdAt", "desc").limit(2000).get();

  const missing = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.audience === undefined || data.audience === null) {
      missing.push(doc.id);
    }
  }

  console.log(`Scanned ${snap.size} recent posts (cap 2000).`);
  console.log(`Posts missing audience field: ${missing.length}`);
  if (missing.length > 0) {
    console.log("Sample IDs:", missing.slice(0, 10).join(", "));
  }

  if (!execute) {
    console.log("\nNo writes performed. Re-run with --execute to apply audience: 'public'.");
    console.log(
      "Note: Map feed already includes legacy posts via audience != 'followers' query; backfill is optional."
    );
    return;
  }

  if (missing.length === 0) {
    console.log("Nothing to update.");
    return;
  }

  const toUpdate = missing.slice(0, BATCH_SIZE);
  const batch = db.batch();
  const now = Date.now();
  for (const id of toUpdate) {
    batch.update(db.collection("posts").doc(id), {
      audience: "public",
      audienceBackfilledAt: now,
    });
  }
  await batch.commit();
  console.log(`Updated ${toUpdate.length} posts. Re-run until missing count is 0.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
