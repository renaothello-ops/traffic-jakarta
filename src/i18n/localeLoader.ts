import type { AppLanguage } from "../types";

const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*.json",
  { eager: false }
);

const loadedLocales = new Set<string>();

function localePath(code: AppLanguage): string {
  return `./locales/${code}.json`;
}

export function isLocaleBundleLoaded(code: AppLanguage): boolean {
  return loadedLocales.has(code);
}

type I18nLike = {
  addResourceBundle: (
    lng: string,
    ns: string,
    resources: Record<string, unknown>,
    deep?: boolean,
    overwrite?: boolean
  ) => void;
};

/** Loads a locale JSON chunk and registers it with i18next (no page reload). */
export async function ensureLocaleLoaded(
  code: AppLanguage,
  i18n: I18nLike
): Promise<void> {
  if (loadedLocales.has(code)) return;
  const loader = localeModules[localePath(code)];
  if (!loader) {
    console.error("[i18n] missing locale module", code);
    return;
  }
  const mod = await loader();
  i18n.addResourceBundle(code, "translation", mod.default, true, true);
  loadedLocales.add(code);
  if (import.meta.env.DEV) {
    console.debug("[i18n] locale bundle loaded", code);
  }
}
