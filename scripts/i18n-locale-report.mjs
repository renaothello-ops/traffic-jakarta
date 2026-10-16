#!/usr/bin/env node
/** Per-locale key parity vs en + English-copy count (not valid as translated). */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const SUPPORTED_LANGUAGE_CODES = [
  "id", "en", "ja", "ko", "zh-Hans", "zh-Hant", "ms", "th", "vi", "fil", "hi",
  "ar", "es", "fr", "de", "pt", "it", "ru", "tr", "nl",
];

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales");

function flatten(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v, p));
    } else if (typeof v === "string") {
      out.push([p, v]);
    }
  }
  return out;
}

const en = new Map(flatten(JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"))));
const total = en.size;

console.log("Language\tOwn keys\tMissing\tSame as EN\tStatus");
for (const lang of SUPPORTED_LANGUAGE_CODES) {
  const path = join(localesDir, `${lang}.json`);
  const loc = new Map(flatten(JSON.parse(readFileSync(path, "utf8"))));
  let missing = 0;
  let sameAsEn = 0;
  let own = 0;
  for (const [k, enV] of en) {
    const lv = loc.get(k);
    if (lv === undefined) {
      missing++;
      continue;
    }
    if (lang === "en") {
      own++;
      continue;
    }
    if (lv === enV) sameAsEn++;
    else own++;
  }
  const status =
    missing > 0 ? "MISSING_KEYS" : sameAsEn === 0 ? "OK" : sameAsEn === total ? "ENGLISH_COPY" : "PARTIAL";
  console.log(`${lang}\t${own}/${total}\t${missing}\t${sameAsEn}\t${status}`);
}
