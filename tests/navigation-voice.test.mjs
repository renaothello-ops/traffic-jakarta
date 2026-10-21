import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldAnnounceVoice,
  speechLocaleFromUiLanguage,
  voiceCuesForProgress,
} from "../src/assets/lib/navigation/navigationVoice.mjs";

const t = (key, opts = {}) => {
  const map = {
    "nav.arrived": "You've arrived",
    "nav.voiceIn": `In ${opts.distanceSpeech}, ${opts.action}${opts.street ?? ""}`,
    "nav.voiceNow": `${opts.action}${opts.street ?? ""}`,
    "nav.voiceOntoStreet": ` onto ${opts.street}`,
    "nav.speech.meters": `${opts.value} meters`,
    "nav.speech.kilometers": `${opts.value} kilometers`,
    "maneuvers.right": "Turn right",
    "maneuvers.unknown": "Continue",
  };
  return map[key] ?? key;
};

test("speechLocaleFromUiLanguage maps BCP 47 for ja/id/en", () => {
  assert.equal(speechLocaleFromUiLanguage("ja"), "ja-JP");
  assert.equal(speechLocaleFromUiLanguage("id-ID"), "id-ID");
  assert.equal(speechLocaleFromUiLanguage("en-US"), "en");
});

test("shouldAnnounceVoice rejects stale or inaccurate fixes", () => {
  const now = Date.now();
  assert.equal(shouldAnnounceVoice(50, now), true);
  assert.equal(shouldAnnounceVoice(200, now), false);
  assert.equal(shouldAnnounceVoice(50, now - 30_000), false);
});

test("voiceCuesForProgress uses distance thresholds and speech units", () => {
  const instruction = {
    index: 2,
    maneuver: "right",
    message: "TomTom English turn text",
    street: "Sudirman",
    distanceMeters: 400,
  };
  const far = voiceCuesForProgress(instruction, 600, false, t, "en");
  assert.equal(far.length, 0);
  const near = voiceCuesForProgress(instruction, 80, false, t, "en");
  assert.equal(near.length, 1);
  assert.match(near[0].text, /Turn right/);
  assert.match(near[0].text, /80 meters/);
  assert.doesNotMatch(near[0].text, /TomTom/);
});
