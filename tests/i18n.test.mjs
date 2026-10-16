import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales");

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const id = JSON.parse(readFileSync(join(localesDir, "id.json"), "utf8"));
const ja = JSON.parse(readFileSync(join(localesDir, "ja.json"), "utf8"));

function keys(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") out.push(...keys(v, p));
    else out.push(p);
  }
  return out;
}

describe("i18n resources", () => {
  it("id and ja include core settings keys", () => {
    assert.ok(en.settings?.notifications);
    assert.ok(id.settings?.notifications);
    assert.ok(ja.settings?.notifications);
  });

  it("language settings search keys exist in en", () => {
    assert.ok(en.language?.search);
    assert.ok(en.language?.searchPlaceholder);
  });

  it("default language constant is Indonesian", async () => {
    const { APP_DEFAULT_LANGUAGE, detectDefaultLanguage } = await import(
      "../src/assets/lib/userProfileDefaults.ts"
    );
    assert.equal(APP_DEFAULT_LANGUAGE, "id");
    assert.equal(detectDefaultLanguage(), "id");
  });

  it("supported language catalog has 20 entries", async () => {
    const { SUPPORTED_LANGUAGE_CODES } = await import(
      "../src/i18n/supportedLanguages.ts"
    );
    assert.equal(SUPPORTED_LANGUAGE_CODES.length, 20);
  });
});
