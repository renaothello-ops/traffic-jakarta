/**
 * Run: npx tsx scripts/i18n-bench.mjs
 */
import { performance } from "node:perf_hooks";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { default: i18n } = await import("../src/i18n/index.ts");
const { applyLanguageInstant } = await import("../src/i18n/languagePreference.ts");

const seq = [
  ["ja", "en"],
  ["en", "id"],
  ["id", "ja"],
];

for (const [from, to] of seq) {
  await applyLanguageInstant(from);
  const ui0 = performance.now();
  await applyLanguageInstant(to);
  const ui1 = performance.now();
  const fs0 = performance.now();
  await new Promise((r) => setTimeout(r, 150));
  const fs1 = performance.now();
  console.log(
    `[i18n-bench-live] ${from}->${to} UI ~${(ui1 - ui0).toFixed(1)}ms Firestore(sim) ~${(fs1 - fs0).toFixed(1)}ms lng=${i18n.language}`
  );
}
