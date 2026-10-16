#!/usr/bin/env node
/** Repair broken brand / placeholder tokens left by machine translation. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales");
const BRANDS = ["TomTom", "Google", "MapLibre", "Waze", "Traffic Jakarta"];

function walk(obj, fn) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") fn(k, v, (s) => { obj[k] = s; });
      else walk(v, fn);
    }
  }
}

function fixString(s) {
  let out = s;
  for (const b of BRANDS) {
    const unders = b.replace(/\s/g, "_");
    const patterns = [
      new RegExp(`__\\s*BR[_\\s]*${unders}\\s*__`, "gi"),
      new RegExp(`__BR_${unders}__`, "gi"),
      new RegExp(`__\\s*BR_${unders}\\s*__`, "gi"),
    ];
    for (const re of patterns) out = out.replace(re, b);
  }
  return out;
}

for (const file of readdirSync(localesDir).filter((f) => f.endsWith(".json"))) {
  const path = join(localesDir, file);
  const tree = JSON.parse(readFileSync(path, "utf8"));
  walk(tree, (_k, v, set) => set(fixString(v)));
  writeFileSync(path, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
  console.log("[i18n-fix-brands]", file);
}
