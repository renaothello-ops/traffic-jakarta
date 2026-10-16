import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function keys(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keys(v, p));
    else out.push(p);
  }
  return out.sort();
}

describe("optimistic language switching", () => {
  it("LanguageSettingsSheet awaits instant apply, not Firestore", () => {
    const src = readFileSync(
      new URL("../src/components/settings/LanguageSettingsSheet.tsx", import.meta.url),
      "utf8"
    );
    assert.match(src, /await applyLanguageInstant/);
    assert.doesNotMatch(src, /await saveLanguage/);
    assert.match(src, /saveLanguageToFirestore\(/);
    assert.match(src, /syncPending/);
  });

  it("UserProfileContext syncs Firestore language without blocking UI path", () => {
    const src = readFileSync(
      new URL("../src/contexts/UserProfileContext.tsx", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(src, /applyLanguagePreference/);
    assert.match(src, /syncLanguageFromFirestoreProfile/);
    assert.doesNotMatch(src, /setProfileLoading\(true\)/);
    assert.match(src, /profileInitialLoading/);
  });

  it("ProfilePanel never full-screen blocks on profile loading during language change", () => {
    const src = readFileSync(
      new URL("../src/components/ProfilePanel.tsx", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(src, /profileLoading/);
    assert.doesNotMatch(src, /if \(loading \|\|/);
    assert.match(src, /settingsSheets/);
  });

  it("saveLanguageToFirestore is separate from local instant persistence", () => {
    const src = readFileSync(
      new URL("../src/assets/lib/userProfile.ts", import.meta.url),
      "utf8"
    );
    assert.match(src, /export async function saveLanguageToFirestore/);
    assert.doesNotMatch(src, /export async function saveLanguage\(/);
  });

  it("i18n loads locale JSON via Vite glob (no HTTP backend)", () => {
    const loader = readFileSync(
      new URL("../src/i18n/localeLoader.ts", import.meta.url),
      "utf8"
    );
    assert.match(loader, /import\.meta\.glob/);
    assert.doesNotMatch(loader, /i18next-http-backend/);
  });

  it("startup language uses localStorage then Indonesian default", () => {
    const defaults = readFileSync(
      new URL("../src/assets/lib/userProfileDefaults.ts", import.meta.url),
      "utf8"
    );
    const i18n = readFileSync(new URL("../src/i18n/index.ts", import.meta.url), "utf8");
    assert.match(defaults, /APP_DEFAULT_LANGUAGE.*"id"/);
    assert.match(i18n, /readStoredLanguage\(\) \?\? APP_DEFAULT_LANGUAGE/);
  });

  it("Firestore failure does not revert language in UI layer", () => {
    const sheet = readFileSync(
      new URL("../src/components/settings/LanguageSettingsSheet.tsx", import.meta.url),
      "utf8"
    );
    assert.match(sheet, /syncPending/);
    assert.doesNotMatch(sheet, /changeLanguage\(.*profile/);
  });
});

describe("i18n locale parity", () => {
  it("en/id/ja share identical key sets", () => {
    const en = JSON.parse(
      readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8")
    );
    const id = JSON.parse(
      readFileSync(new URL("../src/i18n/locales/id.json", import.meta.url), "utf8")
    );
    const ja = JSON.parse(
      readFileSync(new URL("../src/i18n/locales/ja.json", import.meta.url), "utf8")
    );
    assert.deepEqual(keys(id), keys(en));
    assert.deepEqual(keys(ja), keys(en));
  });

  it("loads en, id, and ja language labels", () => {
    for (const file of ["en.json", "id.json", "ja.json"]) {
      const loc = JSON.parse(
        readFileSync(new URL(`../src/i18n/locales/${file}`, import.meta.url), "utf8")
      );
      assert.equal(loc.language.en, "English");
      assert.ok(loc.language.id);
      assert.ok(loc.language.ja);
    }
  });
});
