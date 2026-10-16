import type { AppLanguage } from "../types";
import {
  APP_DEFAULT_LANGUAGE,
  readStoredLanguage,
  storeLanguageLocal,
} from "../assets/lib/userProfileDefaults";
import {
  isAppLanguage,
  languageMeta,
  SUPPORTED_LANGUAGE_CODES,
} from "./supportedLanguages";
import i18n from "./index";
import { loadAppLocale } from "./index";

export { languageMeta };

/** Skip applying Firestore language echo after optimistic user pick. */
let suppressFirestoreLanguageUntil = 0;
let pendingOptimisticLanguage: AppLanguage | null = null;

export function normalizeAppLanguageCode(
  raw: string | undefined | null
): AppLanguage {
  if (raw && isAppLanguage(raw)) return raw;
  const short = raw?.split("-")[0];
  if (short === "ja") return "ja";
  if (short === "id") return "id";
  if (short === "ko") return "ko";
  if (short === "ms") return "ms";
  if (short === "th") return "th";
  if (short === "vi") return "vi";
  if (short === "hi") return "hi";
  if (short === "ar") return "ar";
  if (short === "es") return "es";
  if (short === "fr") return "fr";
  if (short === "de") return "de";
  if (short === "pt") return "pt";
  if (short === "it") return "it";
  if (short === "ru") return "ru";
  if (short === "tr") return "tr";
  if (short === "nl") return "nl";
  if (short === "fil" || short === "tl") return "fil";
  if (raw === "zh-Hant" || raw === "zh-TW" || raw === "zh-HK") return "zh-Hant";
  if (raw === "zh-Hans" || raw === "zh-CN" || short === "zh") return "zh-Hans";
  if (short === "en") return "en";
  return APP_DEFAULT_LANGUAGE;
}

/** @deprecated use normalizeAppLanguageCode */
export function normalizeAppLanguage(raw: string | undefined | null): AppLanguage {
  return normalizeAppLanguageCode(raw);
}

export function getCurrentAppLanguage(): AppLanguage {
  return normalizeAppLanguageCode(i18n.language ?? readStoredLanguage());
}

export function resolveStartupLanguage(): AppLanguage {
  return readStoredLanguage() ?? APP_DEFAULT_LANGUAGE;
}

export function markOptimisticLanguagePick(lang: AppLanguage): void {
  pendingOptimisticLanguage = lang;
  suppressFirestoreLanguageUntil = Date.now() + 5000;
}

export function shouldApplyFirestoreLanguage(lang: AppLanguage): boolean {
  if (Date.now() < suppressFirestoreLanguageUntil) {
    if (pendingOptimisticLanguage === lang) return false;
  }
  if (pendingOptimisticLanguage === lang) {
    pendingOptimisticLanguage = null;
    return false;
  }
  return normalizeAppLanguageCode(i18n.language) !== lang;
}

export async function applyLanguageInstant(language: AppLanguage): Promise<void> {
  markOptimisticLanguagePick(language);
  storeLanguageLocal(language);
  await loadAppLocale(language);
  await i18n.changeLanguage(language);
}

export function syncLanguageFromFirestoreProfile(
  profileLanguage: AppLanguage | undefined
): void {
  if (!profileLanguage || !isAppLanguage(profileLanguage)) return;
  if (!shouldApplyFirestoreLanguage(profileLanguage)) return;
  storeLanguageLocal(profileLanguage);
  void (async () => {
    await loadAppLocale(profileLanguage);
    await i18n.changeLanguage(profileLanguage);
  })();
}

export function localeTagForLanguage(lang: AppLanguage): string {
  return languageMeta(lang).bcp47;
}

export function isSupportedLanguage(code: string): code is AppLanguage {
  return SUPPORTED_LANGUAGE_CODES.includes(code as AppLanguage);
}
