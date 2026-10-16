import type { AppLanguage } from "../types";

export type SupportedLanguageMeta = {
  code: AppLanguage;
  /** BCP 47 tag for Intl / document.lang */
  bcp47: string;
  /** Native label for the language picker (not translated). */
  nativeLabel: string;
  rtl: boolean;
};

export const SUPPORTED_LANGUAGES: SupportedLanguageMeta[] = [
  { code: "id", bcp47: "id-ID", nativeLabel: "Bahasa Indonesia", rtl: false },
  { code: "en", bcp47: "en", nativeLabel: "English", rtl: false },
  { code: "ja", bcp47: "ja-JP", nativeLabel: "日本語", rtl: false },
  { code: "ko", bcp47: "ko-KR", nativeLabel: "한국어", rtl: false },
  { code: "zh-Hans", bcp47: "zh-Hans", nativeLabel: "简体中文", rtl: false },
  { code: "zh-Hant", bcp47: "zh-Hant", nativeLabel: "繁體中文", rtl: false },
  { code: "ms", bcp47: "ms-MY", nativeLabel: "Bahasa Melayu", rtl: false },
  { code: "th", bcp47: "th-TH", nativeLabel: "ไทย", rtl: false },
  { code: "vi", bcp47: "vi-VN", nativeLabel: "Tiếng Việt", rtl: false },
  { code: "fil", bcp47: "fil-PH", nativeLabel: "Filipino", rtl: false },
  { code: "hi", bcp47: "hi-IN", nativeLabel: "हिन्दी", rtl: false },
  { code: "ar", bcp47: "ar", nativeLabel: "العربية", rtl: true },
  { code: "es", bcp47: "es", nativeLabel: "Español", rtl: false },
  { code: "fr", bcp47: "fr-FR", nativeLabel: "Français", rtl: false },
  { code: "de", bcp47: "de-DE", nativeLabel: "Deutsch", rtl: false },
  { code: "pt", bcp47: "pt-BR", nativeLabel: "Português", rtl: false },
  { code: "it", bcp47: "it-IT", nativeLabel: "Italiano", rtl: false },
  { code: "ru", bcp47: "ru-RU", nativeLabel: "Русский", rtl: false },
  { code: "tr", bcp47: "tr-TR", nativeLabel: "Türkçe", rtl: false },
  { code: "nl", bcp47: "nl-NL", nativeLabel: "Nederlands", rtl: false },
];

export const SUPPORTED_LANGUAGE_CODES: AppLanguage[] = SUPPORTED_LANGUAGES.map(
  (l) => l.code
);

export function languageMeta(code: AppLanguage): SupportedLanguageMeta {
  return (
    SUPPORTED_LANGUAGES.find((l) => l.code === code) ??
    SUPPORTED_LANGUAGES[0]
  );
}

export function isAppLanguage(raw: string | null | undefined): raw is AppLanguage {
  return SUPPORTED_LANGUAGE_CODES.includes(raw as AppLanguage);
}
