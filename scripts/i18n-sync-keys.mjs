#!/usr/bin/env node
/**
 * Ensures every locale JSON has the same key structure as en.json.
 * Missing leaf values are copied from en.json (for later translation).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "src/i18n/locales");
const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));

const TARGETS = [
  "id", "ja", "ko", "zh-Hans", "zh-Hant", "ms", "th", "vi", "fil", "hi", "ar",
  "es", "fr", "de", "pt", "it", "ru", "tr", "nl",
];

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== "object" || Array.isArray(patch)) {
    return patch ?? base;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(base?.[k] ?? {}, v);
    } else if (v !== undefined && v !== null && v !== "") {
      out[k] = v;
    } else if (base?.[k] !== undefined) {
      out[k] = base[k];
    }
  }
  return out;
}

/** Fill missing leaves in target from en template. */
function fillMissing(enNode, targetNode) {
  if (enNode == null || typeof enNode !== "object" || Array.isArray(enNode)) {
    return targetNode ?? enNode;
  }
  const out = { ...(targetNode && typeof targetNode === "object" ? targetNode : {}) };
  for (const [k, v] of Object.entries(enNode)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = fillMissing(v, out[k]);
    } else {
      const cur = out[k];
      if (cur === undefined || cur === null || cur === "") {
        out[k] = v;
      }
    }
  }
  return out;
}

for (const code of TARGETS) {
  const path = join(localesDir, `${code}.json`);
  let existing = {};
  if (existsSync(path)) {
    existing = JSON.parse(readFileSync(path, "utf8"));
  }
  const merged = fillMissing(en, existing);
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log("[i18n-sync-keys]", code, "ok");
}
