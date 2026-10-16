#!/usr/bin/env node
/**
 * Heuristic scan for likely hard-coded user-facing strings in TSX.
 * Excludes known safe patterns (imports, classNames, URLs, brands).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const ALLOW = /TomTom|MapLibre|Google|Waze|traffic-jakarta|firebaseapp|http/i;
const JSX_TEXT = />\s*([A-Za-z][A-Za-z\s,'–—]{3,80})\s*</g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(root)) {
  const src = readFileSync(file, "utf8");
  if (src.includes("TrafficIntelligenceDevPanel")) continue;
  let m;
  while ((m = JSX_TEXT.exec(src))) {
    const text = m[1].trim();
    if (ALLOW.test(text)) continue;
    if (text.startsWith("{")) continue;
    hits.push({ file: file.replace(root + "/", ""), text });
  }
}

console.log(`[i18n-audit] ${hits.length} suspicious JSX text nodes`);
for (const h of hits.slice(0, 40)) {
  console.log(`  ${h.file}: "${h.text}"`);
}
if (hits.length > 40) console.log(`  ... and ${hits.length - 40} more`);
