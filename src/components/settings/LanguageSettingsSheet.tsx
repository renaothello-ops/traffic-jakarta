import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppLanguage, UserProfile } from "../../types";
import { saveLanguageToFirestore } from "../../assets/lib/userProfile";
import { readStoredLanguage } from "../../assets/lib/userProfileDefaults";
import {
  applyLanguageInstant,
  normalizeAppLanguageCode,
} from "../../i18n/languagePreference";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguageMeta,
} from "../../i18n/supportedLanguages";
import { IconCheck } from "../icons/AppIcons";

type Props = {
  profile: UserProfile | null;
  onClose: () => void;
};

function matchesSearch(meta: SupportedLanguageMeta, q: string): boolean {
  if (!q) return true;
  const hay = `${meta.code} ${meta.nativeLabel} ${meta.bcp47}`.toLowerCase();
  return hay.includes(q);
}

export default function LanguageSettingsSheet({ profile, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const retriedRef = useRef(false);
  const current = normalizeAppLanguageCode(i18n.language);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUPPORTED_LANGUAGES.filter((meta) => matchesSearch(meta, q));
  }, [query]);

  const runFirestoreSync = (lang: AppLanguage, uid: string) => {
    saveLanguageToFirestore(uid, lang)
      .then(() => setSyncHint(null))
      .catch(() => setSyncHint(t("language.syncPending")));
  };

  useEffect(() => {
    if (!profile?.uid || retriedRef.current) return;
    const local = readStoredLanguage();
    if (local && local !== profile.language) {
      retriedRef.current = true;
      runFirestoreSync(local, profile.uid);
    }
  }, [profile?.uid, profile?.language, t]);

  const pick = (lang: AppLanguage) => {
    setSyncHint(null);
    void (async () => {
      await applyLanguageInstant(lang);
      if (profile?.uid) {
        runFirestoreSync(lang, profile.uid);
      }
    })();
  };

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("language.title")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        {syncHint ? (
          <p className="tj-language-sync-hint" role="status">
            {syncHint}
          </p>
        ) : null}
        <label className="tj-messages-search">
          <span className="tj-sr-only">{t("language.search")}</span>
          <input
            className="tj-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("language.searchPlaceholder")}
          />
        </label>
        <ul className="tj-language-list">
          {filtered.map((meta) => (
            <li key={meta.code}>
              <button
                type="button"
                className={`tj-language-option${current === meta.code ? " tj-language-option--active" : ""}`}
                onClick={() => pick(meta.code)}
                aria-pressed={current === meta.code}
              >
                <span className="tj-language-option__label">{meta.nativeLabel}</span>
                {current === meta.code ? (
                  <IconCheck size={20} className="tj-language-option__check" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 ? (
          <p className="tj-hint">{t("language.searchNoResults")}</p>
        ) : null}
      </div>
    </div>
  );
}
