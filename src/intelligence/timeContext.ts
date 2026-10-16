import type { TimeContext } from "./types";

/** Fixed Asia/Jakarta (WIB). */
export const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Major Indonesian public holidays affecting Jakarta mobility (reference dates only).
 * Source: widely published national holiday calendars — not scraped from social media.
 */
const PUBLIC_HOLIDAYS: Record<string, string> = {
  "2025-01-01": "New Year's Day",
  "2025-03-28": "Nyepi (Bali; some offices closed)",
  "2025-03-29": "Eid al-Fitr (estimated)",
  "2025-03-30": "Eid al-Fitr holiday",
  "2025-04-18": "Good Friday",
  "2025-05-01": "Labour Day",
  "2025-05-12": "Ascension Day",
  "2025-05-29": "Waisak",
  "2025-06-01": "Pancasila Day",
  "2025-06-07": "Eid al-Adha (estimated)",
  "2025-08-17": "Independence Day",
  "2025-12-25": "Christmas",
  "2026-01-01": "New Year's Day",
  "2026-03-20": "Eid al-Fitr (estimated)",
  "2026-03-21": "Eid al-Fitr holiday",
  "2026-04-03": "Good Friday",
  "2026-05-01": "Labour Day",
  "2026-05-14": "Ascension Day",
  "2026-05-17": "Waisak",
  "2026-06-01": "Pancasila Day",
  "2026-05-27": "Eid al-Adha (estimated)",
  "2026-08-17": "Independence Day",
  "2026-12-25": "Christmas",
};

function dateKeyInJakarta(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function buildTimeContext(timestampMs: number = Date.now()): TimeContext {
  const d = new Date(timestampMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekday
  );
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const key = dateKeyInJakarta(timestampMs);
  const holidayName = PUBLIC_HOLIDAYS[key] ?? null;

  return {
    hour,
    dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : 0,
    isWeekend,
    isPublicHoliday: holidayName != null,
    holidayName,
    timezone: JAKARTA_TIMEZONE,
  };
}
