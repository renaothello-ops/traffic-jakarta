import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "../types";
import {
  applyLanguageInstant,
  normalizeAppLanguageCode,
} from "../i18n/languagePreference";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguageMeta,
} from "../i18n/supportedLanguages";
import { saveLanguageToFirestore } from "../assets/lib/userProfile";
import { IconGlobe } from "./icons/AppIcons";

function matchesSearch(meta: SupportedLanguageMeta, q: string): boolean {
  if (!q) return true;
  const hay = `${meta.code} ${meta.nativeLabel} ${meta.bcp47}`.toLowerCase();
  return hay.includes(q);
}

type Props = {
  /** When signed in, persist language to Firestore. */
  profileUid?: string | null;
};

export default function WelcomeLanguageSelect({ profileUid = null }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = normalizeAppLanguageCode(i18n.language);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUPPORTED_LANGUAGES.filter((meta) => matchesSearch(meta, q));
  }, [query]);

  const currentLabel =
    SUPPORTED_LANGUAGES.find((m) => m.code === current)?.nativeLabel ?? current;

  const pick = (lang: AppLanguage) => {
    void (async () => {
      await applyLanguageInstant(lang);
      if (profileUid) {
        await saveLanguageToFirestore(profileUid, lang).catch(() => {});
      }
    })();
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="tj-welcome-lang">
      <button
        type="button"
        className="tj-welcome-lang__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconGlobe size={18} />
        <span>{t("welcome.languageLabel")}</span>
        <span className="tj-welcome-lang__current">{currentLabel}</span>
      </button>
      {open ? (
        <div className="tj-welcome-lang__panel" role="listbox" aria-label={t("language.title")}>
          <input
            className="tj-input tj-welcome-lang__search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("language.searchPlaceholder")}
          />
          <ul className="tj-welcome-lang__list">
            {filtered.map((meta) => (
              <li key={meta.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={current === meta.code}
                  className={`tj-language-option${current === meta.code ? " tj-language-option--active" : ""}`}
                  onClick={() => pick(meta.code)}
                >
                  {meta.nativeLabel}
                </button>
              </li>
            ))}
          </ul>
          {filtered.length === 0 ? (
            <p className="tj-hint">{t("language.searchNoResults")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
