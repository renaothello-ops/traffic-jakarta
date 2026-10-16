import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  APP_DEFAULT_LANGUAGE,
  readStoredLanguage,
} from "../assets/lib/userProfileDefaults";
import { SUPPORTED_LANGUAGE_CODES } from "./supportedLanguages";
import { ensureLocaleLoaded } from "./localeLoader";
import type { AppLanguage } from "../types";

const initialLng: AppLanguage = readStoredLanguage() ?? APP_DEFAULT_LANGUAGE;

let initPromise: Promise<void> | null = null;

export async function initI18n(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!i18n.isInitialized) {
      await i18n.use(initReactI18next).init({
        lng: initialLng,
        supportedLngs: [...SUPPORTED_LANGUAGE_CODES],
        fallbackLng: false,
        interpolation: { escapeValue: false },
        react: { useSuspense: false, bindI18n: "languageChanged loaded" },
        returnEmptyString: false,
        returnNull: false,
      });
    }
    await ensureLocaleLoaded(initialLng, i18n);
  })();
  return initPromise;
}

export async function loadAppLocale(code: AppLanguage): Promise<void> {
  await ensureLocaleLoaded(code, i18n);
}

void initI18n();

export function setAppLanguage(lang: AppLanguage) {
  void loadAppLocale(lang).then(() => i18n.changeLanguage(lang));
}

export default i18n;
