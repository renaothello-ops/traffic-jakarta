#!/usr/bin/env node
/** Align {{placeholders}} in locale strings with en.json (fixes broken MT tokens). */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales");
const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));

function extractPh(s) {
  return s.match(/\{\{[^}]+\}\}/g) ?? [];
}

function fixPlaceholders(enStr, locStr) {
  const enPh = extractPh(enStr);
  if (enPh.length === 0) return locStr;
  const locPh = extractPh(locStr);
  const broken = /__\s*PH\s*\d+\s__|__PH\d+__|\{\{PH\d+\}\}/i.test(locStr);
  if (locPh.join("|") === enPh.join("|") && !broken) return locStr;
  let i = 0;
  return locStr.replace(
    /\{\{[^}]+\}\}|__\s*PH\s*\d+\s__|__PH\d+__|\{\{PH\d+\}\}/gi,
    () => enPh[i++] ?? ""
  );
}

function walk(enNode, locNode, stats) {
  if (enNode == null || typeof enNode !== "object" || Array.isArray(enNode)) {
    if (typeof enNode === "string" && typeof locNode === "string") {
      const next = fixPlaceholders(enNode, locNode);
      if (next !== locNode) stats.fixed++;
      return next;
    }
    return locNode;
  }
  const out = locNode && typeof locNode === "object" && !Array.isArray(locNode) ? { ...locNode } : {};
  for (const [k, enVal] of Object.entries(enNode)) {
    out[k] = walk(enVal, out[k], stats);
  }
  return out;
}

for (const file of readdirSync(localesDir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const loc = JSON.parse(readFileSync(join(localesDir, file), "utf8"));
  const stats = { fixed: 0 };
  const next = walk(en, loc, stats);
  writeFileSync(join(localesDir, file), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`[i18n-restore-placeholders] ${file} fixed=${stats.fixed}`);
}
