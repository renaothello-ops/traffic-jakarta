import type { TFunction } from "i18next";
import { formatDistance } from "../geo";

export function formatReportAheadI18n(t: TFunction, distanceM: number): string {
  return t("routeReports.ahead", {
    distance: formatDistance(Math.round(distanceM)),
  });
}

export function formatRecentConfirmLineI18n(
  t: TFunction,
  recentConfirmCount5m: number
): string {
  const n = Math.max(0, recentConfirmCount5m);
  return t("routeReports.recentConfirms", { count: n });
}
