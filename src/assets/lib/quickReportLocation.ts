import type { GpsFix } from "../../types";

/** Max age for last-known GPS fallback during navigation reporting. */
export const QUICK_REPORT_GPS_MAX_AGE_MS = 30_000;

export type QuickReportLocation = {
  lat: number;
  lng: number;
  /** True when using live fix; false when using recent stale fallback */
  isLive: boolean;
};

export function resolveQuickReportLocation(
  rawGps: GpsFix | null,
  gpsFix: GpsFix | null
): QuickReportLocation | null {
  const now = Date.now();
  const fix = rawGps ?? gpsFix;
  if (fix && now - fix.timestamp <= QUICK_REPORT_GPS_MAX_AGE_MS) {
    return { lat: fix.lat, lng: fix.lng, isLive: true };
  }
  if (fix && now - fix.timestamp <= QUICK_REPORT_GPS_MAX_AGE_MS * 2) {
    return { lat: fix.lat, lng: fix.lng, isLive: false };
  }
  return null;
}
