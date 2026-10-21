/** Node-testable mirror of navigationSpeech.ts — keep in sync when changing speech rules. */

const BCP47_BY_UI = {
  id: "id-ID",
  en: "en",
  ja: "ja-JP",
  ko: "ko-KR",
  "zh-Hans": "zh-Hans",
  "zh-Hant": "zh-Hant",
  ms: "ms-MY",
  th: "th-TH",
  vi: "vi-VN",
  fil: "fil-PH",
  hi: "hi-IN",
  ar: "ar",
  es: "es",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  it: "it-IT",
  ru: "ru-RU",
  tr: "tr-TR",
  nl: "nl-NL",
};

export function speechLocaleFromUiLanguage(language) {
  const raw = (language ?? "en").trim();
  if (BCP47_BY_UI[raw]) return BCP47_BY_UI[raw];
  const base = raw.split("-")[0]?.toLowerCase() ?? "en";
  if (BCP47_BY_UI[base]) return BCP47_BY_UI[base];
  return raw;
}

function uiLanguageBase(language) {
  const raw = (language ?? "en").trim();
  if (BCP47_BY_UI[raw]) return raw;
  const base = raw.split("-")[0]?.toLowerCase() ?? "en";
  return base;
}

export function formatSpeechNumber(value, language) {
  const base = uiLanguageBase(language);
  if (base === "id") return String(value).replace(".", ",");
  return String(value);
}

function looksLikeMissingTranslation(key, result) {
  if (!result || result === key) return true;
  if (result.startsWith("nav.") || result.startsWith("maneuvers.")) return true;
  if (result.includes("{{")) return true;
  return false;
}

export function safeNavTranslate(t, key, options = {}) {
  const fallback =
    typeof options.defaultValue === "string" && options.defaultValue ? options.defaultValue : "";
  const raw = t(key, { ...options, defaultValue: fallback || undefined });
  if (looksLikeMissingTranslation(key, raw)) {
    if (fallback) return fallback;
    const unknown = t("maneuvers.unknown", { defaultValue: "Continue" });
    return looksLikeMissingTranslation("maneuvers.unknown", unknown) ? "Continue" : unknown;
  }
  return raw;
}

export function formatMetersForSpeech(meters, t, language) {
  const m = Math.max(0, Math.round(meters));
  if (m >= 1000) {
    const km = m / 1000;
    const value =
      km >= 10
        ? formatSpeechNumber(String(Math.round(km)), language)
        : formatSpeechNumber(km.toFixed(1).replace(/\.0$/, ""), language);
    return safeNavTranslate(t, "nav.speech.kilometers", {
      value,
      defaultValue: `${value} kilometers`,
    });
  }
  const value = formatSpeechNumber(String(m), language);
  return safeNavTranslate(t, "nav.speech.meters", {
    value,
    count: m,
    defaultValue: `${value} meters`,
  });
}

export function formatSecondsForSpeech(seconds, t, language) {
  const s = Math.max(0, Math.round(seconds));
  const minutes = Math.max(1, Math.round(s / 60));
  const value = formatSpeechNumber(String(minutes), language);
  const key = minutes === 1 ? "nav.speech.minute" : "nav.speech.minutes";
  return safeNavTranslate(t, key, {
    value,
    count: minutes,
    defaultValue: minutes === 1 ? `${value} minute` : `${value} minutes`,
  });
}

export function localizedManeuverAction(instruction, t) {
  const key = `maneuvers.${instruction.maneuver ?? "unknown"}`;
  return safeNavTranslate(t, key, {
    defaultValue: safeNavTranslate(t, "maneuvers.unknown", { defaultValue: "Continue" }),
  });
}

export function streetSuffixForSpeech(instruction, t) {
  if (!instruction.street?.trim()) return "";
  return safeNavTranslate(t, "nav.voiceOntoStreet", {
    street: instruction.street.trim(),
    defaultValue: ` onto ${instruction.street.trim()}`,
  });
}

export function voiceInSpeechText(distanceMeters, instruction, t, language) {
  const distanceSpeech = formatMetersForSpeech(distanceMeters, t, language);
  const action = localizedManeuverAction(instruction, t);
  const street = streetSuffixForSpeech(instruction, t);
  return safeNavTranslate(t, "nav.voiceIn", {
    distanceSpeech,
    distance: distanceSpeech,
    action,
    street,
    defaultValue: `In ${distanceSpeech}, ${action}${street}`,
  });
}

export function voiceNowSpeechText(instruction, t) {
  const action = localizedManeuverAction(instruction, t);
  const street = streetSuffixForSpeech(instruction, t);
  return safeNavTranslate(t, "nav.voiceNow", {
    action,
    street,
    defaultValue: `${action}${street}`,
  });
}
