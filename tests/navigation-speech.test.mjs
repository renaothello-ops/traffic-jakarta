import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  formatMetersForSpeech,
  formatSecondsForSpeech,
  formatSpeechNumber,
  speechLocaleFromUiLanguage,
  voiceInSpeechText,
} from "../src/assets/lib/navigation/navigationSpeech.mjs";

const localesDir = new URL("../src/i18n/locales/", import.meta.url);

function loadLocale(code) {
  return JSON.parse(readFileSync(new URL(`${code}.json`, localesDir), "utf8"));
}

function tFactory(locale) {
  const nav = locale.nav ?? {};
  const maneuvers = locale.maneuvers ?? {};
  return (key, opts = {}) => {
    const parts = key.split(".");
    let node = locale;
    for (const p of parts) {
      node = node?.[p];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      opts[name] != null ? String(opts[name]) : ""
    );
  };
}

test("formatMetersForSpeech avoids km/m abbreviations (ja, en, id)", () => {
  const ja = tFactory(loadLocale("ja"));
  assert.equal(formatMetersForSpeech(300, ja, "ja"), "300メートル");
  assert.equal(formatMetersForSpeech(1500, ja, "ja"), "1.5キロメートル");

  const en = tFactory(loadLocale("en"));
  assert.match(formatMetersForSpeech(300, en, "en"), /300 meters/);
  assert.match(formatMetersForSpeech(1500, en, "en"), /1\.5 kilometers/);

  const id = tFactory(loadLocale("id"));
  assert.match(formatMetersForSpeech(1500, id, "id"), /1,5 kilometer/);
  assert.match(formatMetersForSpeech(300, id, "id"), /300 meter/);
});

test("formatSecondsForSpeech uses spoken minutes", () => {
  const ja = tFactory(loadLocale("ja"));
  assert.equal(formatSecondsForSpeech(300, ja, "ja"), "5分");
  const en = tFactory(loadLocale("en"));
  assert.match(formatSecondsForSpeech(300, en, "en"), /5 minutes/);
});

test("formatSpeechNumber uses comma decimal for Indonesian", () => {
  assert.equal(formatSpeechNumber("1.5", "id"), "1,5");
  assert.equal(formatSpeechNumber("1.5", "en"), "1.5");
});

test("speechLocaleFromUiLanguage covers supported app languages", () => {
  assert.equal(speechLocaleFromUiLanguage("ja"), "ja-JP");
  assert.equal(speechLocaleFromUiLanguage("zh-Hans"), "zh-Hans");
  assert.equal(speechLocaleFromUiLanguage("pt-BR"), "pt-BR");
});

test("voiceInSpeechText uses localized maneuver not TomTom message", () => {
  const en = tFactory(loadLocale("en"));
  const instruction = {
    index: 1,
    maneuver: "right",
    message: "Turn right onto English-only street name",
    street: "Sudirman",
    distanceMeters: 80,
  };
  const text = voiceInSpeechText(80, instruction, en, "en");
  assert.match(text, /Turn right/);
  assert.doesNotMatch(text, /English-only street name/);
  assert.match(text, /80 meters/);
  assert.doesNotMatch(text, /\b80 m\b/);
});

test("all locales define nav.speech and distanceSpeech voiceIn template", () => {
  const codes = [
    "en", "ja", "id", "ko", "zh-Hans", "zh-Hant", "ms", "th", "vi", "fil", "hi", "ar",
    "es", "fr", "de", "pt", "it", "ru", "tr", "nl",
  ];
  for (const code of codes) {
    const loc = loadLocale(code);
    assert.ok(loc.nav?.speech?.meters, `${code} nav.speech.meters`);
    assert.ok(loc.nav?.speech?.kilometers, `${code} nav.speech.kilometers`);
    assert.match(loc.nav?.voiceIn ?? "", /distanceSpeech/, `${code} voiceIn`);
  }
});
