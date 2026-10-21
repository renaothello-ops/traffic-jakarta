/** Node-testable voice helpers (mirrors voice.ts logic). */

import {
  safeNavTranslate,
  speechLocaleFromUiLanguage,
  voiceInSpeechText,
  voiceNowSpeechText,
} from "./navigationSpeech.mjs";

export {
  formatMetersForSpeech,
  formatSecondsForSpeech,
  formatSpeechNumber,
  localizedManeuverAction,
  safeNavTranslate,
  speechLocaleFromUiLanguage,
  streetSuffixForSpeech,
  voiceInSpeechText,
  voiceNowSpeechText,
} from "./navigationSpeech.mjs";

export function shouldAnnounceVoice(accuracy, timestampMs) {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return false;
  if (Date.now() - timestampMs > 20_000) return false;
  if (accuracy != null && accuracy > 120) return false;
  return true;
}

export function voiceCuesForProgress(
  instruction,
  distanceToManeuverM,
  arrived,
  t,
  language = "en"
) {
  if (arrived) {
    return [
      {
        key: "arrive",
        text: safeNavTranslate(t, "nav.arrived", { defaultValue: "You've arrived" }),
      },
    ];
  }

  const cues = [];
  if (distanceToManeuverM <= 30 && instruction.maneuver !== "straight") {
    cues.push({
      key: `now-${instruction.index}`,
      text: voiceNowSpeechText(instruction, t),
    });
  } else if (distanceToManeuverM <= 100) {
    cues.push({
      key: `100-${instruction.index}`,
      text: voiceInSpeechText(Math.round(distanceToManeuverM), instruction, t, language),
    });
  } else if (distanceToManeuverM <= 500) {
    cues.push({
      key: `500-${instruction.index}`,
      text: voiceInSpeechText(Math.round(distanceToManeuverM), instruction, t, language),
    });
  }
  return cues;
}
