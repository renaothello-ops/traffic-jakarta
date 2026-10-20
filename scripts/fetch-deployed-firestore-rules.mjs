#!/usr/bin/env node
/**
 * Download Firestore rules currently released in Firebase (diff vs firestore.rules).
 *
 *   export FIREBASE_PROJECT_ID=<from Firebase Console>
 *   export FIREBASE_ACCESS_TOKEN=$(firebase login:ci 2>/dev/null | ...)  # one-time CI token
 *   # or: export FIREBASE_ACCESS_TOKEN=$(gcloud auth print-access-token)
 *
 *   node scripts/fetch-deployed-firestore-rules.mjs
 *
 * Output: firestore.rules.deployed (gitignored pattern — do not commit)
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const token = process.env.FIREBASE_ACCESS_TOKEN?.trim();

if (!projectId) {
  console.error(
    "Set FIREBASE_PROJECT_ID (Firebase Console → Project settings → Project ID)."
  );
  process.exit(1);
}
if (!token) {
  console.error(
    "Set FIREBASE_ACCESS_TOKEN (e.g. gcloud auth print-access-token, or firebase login:ci token)."
  );
  process.exit(1);
}

const outPath = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), "firestore.rules.deployed")
);

async function apiGet(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${url}\n${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

const releases = await apiGet(
  `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`
);
const release = (releases.releases ?? []).find((r) =>
  r.name?.endsWith("/releases/cloud.firestore")
);
if (!release?.rulesetName) {
  console.error("No cloud.firestore release:", JSON.stringify(releases, null, 2));
  process.exit(1);
}

const ruleset = await apiGet(
  `https://firebaserules.googleapis.com/v1/${release.rulesetName}`
);
const source =
  ruleset.source?.files?.[0]?.content ??
  ruleset.result?.source?.files?.[0]?.content;

if (!source) {
  console.error("Empty ruleset source:", JSON.stringify(ruleset, null, 2).slice(0, 600));
  process.exit(1);
}

writeFileSync(outPath, source, "utf8");
console.error(`Wrote ${outPath}`);
console.error("Compare: diff -u firestore.rules.deployed firestore.rules");
