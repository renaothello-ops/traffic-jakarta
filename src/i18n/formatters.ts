import type { AppLanguage } from "../types";
import { getCurrentAppLanguage, localeTagForLanguage } from "./languagePreference";

export function appLocaleTag(lang?: AppLanguage): string {
  return localeTagForLanguage(lang ?? getCurrentAppLanguage());
}

export function formatTimeAgo(ts: number, lang?: AppLanguage): string {
  const locale = appLocaleTag(lang);
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 1) {
    if (diffSec < 10) return rtf.format(0, "second");
    return rtf.format(-diffSec, "second");
  }
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.floor(diffHour / 24);
  return rtf.format(-diffDay, "day");
}

export function formatJakartaDateTime(
  ms: number,
  lang?: AppLanguage,
  options?: Intl.DateTimeFormatOptions
): string {
  const locale = appLocaleTag(lang);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Jakarta",
    ...options,
  }).format(ms);
}
