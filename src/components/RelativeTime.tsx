import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatTimeAgo } from "../i18n/formatters";
import { normalizeAppLanguageCode } from "../i18n/languagePreference";

/** Re-renders when the active locale changes (unlike bare timeAgo()). */
export default function RelativeTime({ ts }: { ts: number }) {
  const { i18n } = useTranslation();
  const text = useMemo(
    () => formatTimeAgo(ts, normalizeAppLanguageCode(i18n.language)),
    [ts, i18n.language]
  );
  return <>{text}</>;
}
