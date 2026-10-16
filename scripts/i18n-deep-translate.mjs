#!/usr/bin/env node
/**
 * Builds locale JSON from en.json (Google gtx translate + MyMemory fallback).
 * Preserves {{placeholders}} and brand names. Keeps id/ja existing translations.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const CURL_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "src/i18n/locales");
const cacheDir = join(root, "scripts/.i18n-cache");

const TARGETS = {
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
};

const BRANDS = ["TomTom", "Google", "MapLibre", "Waze", "Traffic Jakarta"];

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

function translateTree(enNode, preserveNode, lookup) {
  if (enNode == null || typeof enNode !== "object" || Array.isArray(enNode)) {
    const enStr = enNode;
    if (typeof preserveNode === "string" && preserveNode !== enStr) {
      return preserveNode;
    }
    return typeof enStr === "string" ? lookup(enStr) : enStr;
  }
  const out = {};
  for (const [k, v] of Object.entries(enNode)) {
    out[k] = translateTree(v, preserveNode?.[k], lookup);
  }
  return out;
}

function collectStrings(node, set = new Set()) {
  if (node == null || typeof node !== "object") {
    if (typeof node === "string") set.add(node);
    return set;
  }
  for (const v of Object.values(node)) collectStrings(v, set);
  return set;
}

function protect(text) {
  const ph = [];
  let s = text.replace(/\{\{[^}]+\}\}/g, (m) => {
    ph.push(m);
    return `__PH${ph.length - 1}__`;
  });
  for (const b of BRANDS) {
    s = s.split(b).join(`__BR_${b.replace(/\s/g, "_")}__`);
  }
  return { s, ph };
}

function unprotect(text, ph) {
  let s = text;
  for (const b of BRANDS) {
    const spaced = `__ BR _ ${b.replace(/\s/g, "_")} __`;
    s = s.split(spaced).join(b);
    s = s.split(`__BR_${b.replace(/\s/g, "_")}__`).join(b);
  }
  ph.forEach((p, i) => {
    const re = new RegExp(`__\\s*PH\\s*${i}\\s*__`, "gi");
    s = s.replace(re, p);
    s = s.replaceAll(`__PH${i}__`, p);
  });
  return s;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function placeholdersOk(source, translated) {
  const pick = (s) => (s.match(/\{\{[^}]+\}\}/g) ?? []).sort().join("|");
  return pick(source) === pick(translated);
}

async function translateGtx(text, tl) {
  const { s, ph } = protect(text);
  if (!s.trim()) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(s.slice(0, 450))}`;
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-s", "-A", CURL_UA, url],
      { maxBuffer: 2 * 1024 * 1024 }
    );
    if (stdout.startsWith("<")) return null;
    const data = JSON.parse(stdout);
    const raw = data?.[0]?.[0]?.[0];
    if (!raw || typeof raw !== "string") return null;
    const out = unprotect(raw, ph);
    if (!placeholdersOk(text, out)) return text;
    return out;
  } catch {
    return null;
  }
}

async function translateMyMemory(text, pair) {
  const { s, ph } = protect(text);
  if (!s.trim()) return text;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(s.slice(0, 450))}&langpair=en|${pair}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data?.responseData?.translatedText;
  if (!raw || /MYMEMORY WARNING/i.test(raw)) return null;
  return unprotect(raw, ph);
}

async function translateOne(text, pair) {
  const gtx = await translateGtx(text, pair);
  if (gtx && gtx !== text && placeholdersOk(text, gtx)) return gtx;
  const mm = await translateMyMemory(text, pair);
  if (mm && mm !== text && placeholdersOk(text, mm)) return mm;
  return text;
}

async function translateUnique(strings, cacheKey, pair) {
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, `${cacheKey}.json`);
  let cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};

  for (const s of strings) {
    const cached = cache[s];
    if (cached && cached !== s) continue;
    if (cached === s && BRANDS.some((b) => s.includes(b))) continue;
    await sleep(80);
    try {
      cache[s] = await translateOne(s, pair);
    } catch {
      cache[s] = s;
    }
    if (Object.keys(cache).length % 25 === 0) {
      writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    }
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  return (s) => cache[s] ?? s;
}

async function buildLocale(langCode) {
  const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
  const preservePath = join(localesDir, `${langCode}.json`);
  const preserve = existsSync(preservePath)
    ? JSON.parse(readFileSync(preservePath, "utf8"))
    : {};

  if (langCode === "id" || langCode === "ja") {
    return translateTree(en, preserve, (s) => s);
  }

  const pair = TARGETS[langCode];
  if (!pair) throw new Error(`Unknown lang ${langCode}`);

  const unique = [...collectStrings(en)];
  const lookup = await translateUnique(unique, langCode, pair);
  return translateTree(en, preserve, lookup);
}

const args = process.argv.slice(2);
const langs = args.length ? args : Object.keys(TARGETS);

for (const lang of langs) {
  console.log("[i18n-deep-translate] building", lang);
  const tree = await buildLocale(lang);
  writeFileSync(
    join(localesDir, `${lang}.json`),
    `${JSON.stringify(tree, null, 2)}\n`,
    "utf8"
  );
}

console.log("[i18n-deep-translate] done");
