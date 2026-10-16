import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "src/i18n/locales");

const EXPECTED_LANGS = [
  "id", "en", "ja", "ko", "zh-Hans", "zh-Hant", "ms", "th", "vi", "fil", "hi",
  "ar", "es", "fr", "de", "pt", "it", "ru", "tr", "nl",
];

function flatten(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v, p));
    } else {
      out.push([p, v]);
    }
  }
  return out;
}

function extractPlaceholders(s) {
  if (typeof s !== "string") return [];
  const m = s.match(/\{\{[^}]+\}\}/g);
  return m ? [...m].sort().join("|") : "";
}

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const enFlat = new Map(flatten(en));

describe("i18n parity (20 languages)", () => {
  it("locale files exist for all supported languages", () => {
    const files = readdirSync(localesDir).filter((f) => f.endsWith(".json"));
    for (const code of EXPECTED_LANGS) {
      assert.ok(files.includes(`${code}.json`), `missing locale file ${code}.json`);
    }
  });

  for (const code of EXPECTED_LANGS) {
    it(`${code} has complete keys vs en`, () => {
      const loc = JSON.parse(
        readFileSync(join(localesDir, `${code}.json`), "utf8")
      );
      const locFlat = new Map(flatten(loc));
      assert.equal(locFlat.size, enFlat.size, `${code} key count mismatch`);
      for (const [key, enVal] of enFlat) {
        assert.ok(locFlat.has(key), `${code} missing key ${key}`);
        const val = locFlat.get(key);
        assert.ok(typeof val === "string", `${code} ${key} not string`);
        assert.notEqual(val.trim(), "", `${code} empty ${key}`);
        assert.equal(
          extractPlaceholders(val),
          extractPlaceholders(enVal),
          `${code} placeholder mismatch ${key}`
        );
      }
    });
  }

  it("reports summary table data", () => {
    const rows = EXPECTED_LANGS.map((code) => {
      const loc = JSON.parse(
        readFileSync(join(localesDir, `${code}.json`), "utf8")
      );
      const locFlat = flatten(loc);
      const missing = [...enFlat.keys()].filter(
        (k) => !locFlat.some(([lk]) => lk === k)
      );
      const empty = locFlat.filter(([, v]) => !String(v).trim()).length;
      return { code, keys: locFlat.length, missing: missing.length, empty };
    });
    console.log("\n[i18n-parity summary]");
    for (const r of rows) {
      console.log(
        `${r.code}\tkeys=${r.keys}\tmissing=${r.missing}\tempty=${r.empty}\t${r.missing === 0 && r.empty === 0 ? "OK" : "FAIL"}`
      );
    }
    assert.ok(rows.every((r) => r.missing === 0 && r.empty === 0));
  });
});
