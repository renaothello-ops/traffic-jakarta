import { useState } from "react";
import { useTranslation } from "react-i18next";
import { searchPublicProfilesByPrefix } from "../assets/lib/socialGraph";
import { getPublicProfile } from "../assets/lib/publicProfile";
import type { PublicUserProfile } from "../types";

type Props = {
  onClose: () => void;
  onSelectProfile: (uid: string) => void;
};

export default function UserSearchSheet({ onClose, onSelectProfile }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  async function runSearch() {
    setSearching(true);
    try {
      const uids = await searchPublicProfilesByPrefix(query, 20);
      const profiles = (
        await Promise.all(uids.map((uid) => getPublicProfile(uid)))
      ).filter(Boolean) as PublicUserProfile[];
      setResults(profiles);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("social.userSearch")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <div className="tj-search-wrap">
          <input
            className="tj-input tj-input--search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("social.userSearchPlaceholder")}
          />
          <button
            type="button"
            className="tj-btn tj-btn--primary tj-btn--compact"
            disabled={searching || query.trim().length < 2}
            onClick={() => void runSearch()}
          >
            {searching ? t("common.loading") : t("social.search")}
          </button>
        </div>
        <ul className="tj-user-search-list">
          {results.map((p) => (
            <li key={p.uid}>
              <button
                type="button"
                className="tj-user-search-row"
                onClick={() => onSelectProfile(p.uid)}
              >
                <strong>{p.displayName || t("common.anonymous")}</strong>
                {p.username ? <span>@{p.username}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
