/** Node-testable voice helpers (mirrors voice.ts logic). */

const SPEECH_LOCALE_BY_UI = {
  ja: "ja-JP",
  id: "id-ID",
  en: "en-US",
};

export function speechLocaleFromUiLanguage(language) {
  const base = language.split("-")[0]?.toLowerCase() ?? "en";
  return SPEECH_LOCALE_BY_UI[base] ?? language;
}

export function shouldAnnounceVoice(accuracy, timestampMs) {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return false;
  if (Date.now() - timestampMs > 20_000) return false;
  if (accuracy != null && accuracy > 120) return false;
  return true;
}

function maneuverAction(instruction, t) {
  if (instruction.message?.trim()) return instruction.message.trim();
  return t(`maneuvers.${instruction.maneuver}`, {
    defaultValue: t("maneuvers.unknown"),
  });
}

function streetSuffix(instruction, t) {
  if (!instruction.street?.trim()) return "";
  return t("nav.voiceOntoStreet", { street: instruction.street });
}

export function voiceCuesForProgress(
  instruction,
  distanceToManeuverM,
  arrived,
  t
) {
  if (arrived) {
    return [{ key: "arrive", text: t("nav.arrived") }];
  }

  const action = maneuverAction(instruction, t);
  const onto = streetSuffix(instruction, t);
  const cues = [];

  if (distanceToManeuverM <= 30 && instruction.maneuver !== "straight") {
    cues.push({
      key: `now-${instruction.index}`,
      text: t("nav.voiceNow", { action, street: onto }),
    });
  } else if (distanceToManeuverM <= 100) {
    cues.push({
      key: `100-${instruction.index}`,
      text: t("nav.voiceIn", {
        distance: `${distanceToManeuverM} m`,
        action,
        street: onto,
      }),
    });
  } else if (distanceToManeuverM <= 500) {
    cues.push({
      key: `500-${instruction.index}`,
      text: t("nav.voiceIn", {
        distance: `${distanceToManeuverM} m`,
        action,
        street: onto,
      }),
    });
  }
  return cues;
}
