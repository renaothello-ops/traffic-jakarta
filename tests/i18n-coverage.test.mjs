import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales");

const MUST_TRANSLATE = [
  "ko", "zh-Hans", "zh-Hant", "ms", "th", "vi", "fil", "hi", "ar", "es", "fr",
  "de", "pt", "it", "ru", "tr", "nl",
];

/** Keys allowed to stay identical to English (brands, units, emoji). */
const SAME_AS_EN_OK = new Set([
  "common.yes",
  "common.no",
  "profile.ganjilGenap",
  "settings.smartTraffic",
]);

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

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const enMap = new Map(flatten(en));

function scriptSample(text, lang) {
  if (lang === "ko" && /[\uAC00-\uD7AF]/.test(text)) return true;
  if (lang === "ja" && /[\u3040-\u30FF\u4E00-\u9FFF]/.test(text)) return true;
  if (lang.startsWith("zh") && /[\u4E00-\u9FFF]/.test(text)) return true;
  if (lang === "ar" && /[\u0600-\u06FF]/.test(text)) return true;
  if (lang === "th" && /[\u0E00-\u0E7F]/.test(text)) return true;
  if (lang === "hi" && /[\u0900-\u097F]/.test(text)) return true;
  if (lang === "ru" && /[\u0400-\u04FF]/.test(text)) return true;
  if (["es", "fr", "de", "pt", "it", "nl", "tr", "vi", "ms", "fil"].includes(lang)) {
    return text !== enMap.get("_") && !/^[\x00-\x7F]*$/.test(text) || text.length < 4;
  }
  return false;
}

describe("i18n translation coverage (not English copy)", () => {
  for (const lang of MUST_TRANSLATE) {
    it(`${lang} is not mostly English copy`, () => {
      const loc = JSON.parse(
        readFileSync(join(localesDir, `${lang}.json`), "utf8")
      );
      const locMap = new Map(flatten(loc));
      let sameAsEn = 0;
      for (const [k, enV] of enMap) {
        const lv = locMap.get(k);
        if (lv === enV) sameAsEn += 1;
      }
      const maxSame = Math.floor(enMap.size * 0.05);
      assert.ok(
        sameAsEn <= maxSame,
        `${lang}: ${sameAsEn}/${enMap.size} keys identical to English — run npm run i18n:translate`
      );
    });

    it(`${lang} has localized sample keys`, () => {
      const loc = JSON.parse(
        readFileSync(join(localesDir, `${lang}.json`), "utf8")
      );
      const locMap = new Map(flatten(loc));
      const samples = [
        "common.close",
        "common.save",
        "nav.map",
        "nav.community",
        "nav.profile",
        "settings.language",
        "messages.title",
        "errors.loadFailed",
      ];
      let localized = 0;
      for (const key of samples) {
        const v = locMap.get(key);
        const enV = enMap.get(key);
        if (!v || !enV) continue;
        if (SAME_AS_EN_OK.has(key)) continue;
        if (v !== enV) localized += 1;
        else if (scriptSample(v, lang)) localized += 1;
      }
      assert.ok(
        localized >= 6,
        `${lang}: only ${localized}/${samples.length} sample keys differ from English — run npm run i18n:translate`
      );
    });
  }

  it("registry lists 20 locale files", () => {
    const files = readdirSync(localesDir).filter((f) => f.endsWith(".json"));
    assert.equal(files.length, 20);
  });
});
