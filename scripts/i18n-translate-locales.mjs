#!/usr/bin/env node
/**
 * Machine-assist locale fill from en.json via MyMemory (dev/build time only).
 * Usage: node scripts/i18n-translate-locales.mjs [lang...]
 * Cache: scripts/.i18n-cache/<lang>.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "src/i18n/locales");
const cacheDir = join(root, "scripts/.i18n-cache");

const MYMEMORY = {
  ko: "ko",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  ms: "ms",
  th: "th",
  vi: "vi",
  fil: "tl",
  hi: "hi",
  ar: "ar",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt",
  it: "it",
  ru: "ru",
  tr: "tr",
  nl: "nl",
  id: "id",
  ja: "ja",
};

const SKIP_IDENTICAL = new Set([
  "TomTom",
  "Google",
  "MapLibre",
  "Waze",
  "Traffic Jakarta",
  "Ganjil–Genap",
  "OK",
  "GPS",
  "API",
  "ML",
  "…",
  "✕",
  "📷",
  "📍",
  "🛣",
  "🚦",
  "➕",
  "✓",
  "!",
]);

const BRANDS = [
  "TomTom",
  "Google",
  "MapLibre",
  "Waze",
  "Traffic Jakarta",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function protectString(text) {
  const placeholders = [];
  let s = text.replace(/\{\{[^}]+\}\}/g, (m) => {
    placeholders.push(m);
    return `__PH${placeholders.length - 1}__`;
  });
  for (const b of BRANDS) {
    s = s.split(b).join(`⟦BR:${b}⟧`);
  }
  return { s, placeholders };
}

function unprotectString(text, placeholders) {
  let s = text;
  for (const b of BRANDS) {
    s = s.split(`⟦BR:${b}⟧`).join(b);
  }
  placeholders.forEach((ph, i) => {
    s = s.replace(`__PH${i}__`, ph);
    s = s.replace(new RegExp(`__PH${i}__`, "g"), ph);
  });
  return s;
}

async function translateText(text, targetCode) {
  if (!text || typeof text !== "string") return text;
  if (SKIP_IDENTICAL.has(text.trim())) return text;
  if (/^[\d\s\W]+$/.test(text)) return text;

  const { s, placeholders } = protectString(text);
  if (!s.trim()) return text;

  const pair = MYMEMORY[targetCode];
  if (!pair) return text;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(s.slice(0, 480))}&langpair=en|${pair}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated) return text;
  return unprotectString(translated, placeholders);
}

function loadCache(lang) {
  const p = join(cacheDir, `${lang}.json`);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveCache(lang, cache) {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, `${lang}.json`), JSON.stringify(cache, null, 2));
}

async function translateTree(enNode, tgtNode, lang, cache, stats) {
  if (enNode == null || typeof enNode !== "object" || Array.isArray(enNode)) {
    return tgtNode ?? enNode;
  }
  const out = { ...(tgtNode && typeof tgtNode === "object" ? tgtNode : {}) };
  for (const [k, v] of Object.entries(enNode)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = await translateTree(v, out[k], lang, cache, stats);
    } else if (typeof v === "string") {
      const current = out[k];
      if ((lang === "id" || lang === "ja") && current && current !== v) {
        out[k] = current;
        continue;
      }
      if (cache[v]) {
        out[k] = cache[v];
        stats.cached += 1;
      } else {
        const enVal = v;
        let next = current;
        if (!current || current === enVal) {
          await sleep(120);
          try {
            next = await translateText(enVal, lang);
          } catch (e) {
            console.warn("[translate fail]", lang, k, e.message);
            next = enVal;
          }
          cache[enVal] = next;
          stats.translated += 1;
        }
        out[k] = next;
      }
    }
  }
  return out;
}

const args = process.argv.slice(2);
const langs =
  args.length > 0
    ? args
    : Object.keys(MYMEMORY).filter((l) => l !== "en");

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));

for (const lang of langs) {
  if (lang === "en" || lang === "id" || lang === "ja") continue;
  const path = join(localesDir, `${lang}.json`);
  const existing = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : {};
  const cache = loadCache(lang);
  const stats = { translated: 0, cached: 0 };
  console.log("[i18n-translate] start", lang);
  const out = await translateTree(en, existing, lang, cache, stats);
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  saveCache(lang, cache);
  console.log("[i18n-translate] done", lang, stats);
}
