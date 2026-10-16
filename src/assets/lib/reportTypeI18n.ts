import type { TFunction } from "i18next";
import type { PostType } from "../../types";

export function reportTypeLabel(t: TFunction, type: PostType): string {
  return t(`reportTypes.${type}.label`);
}

export function reportTypeShortLabel(t: TFunction, type: PostType): string {
  return t(`reportTypes.${type}.shortLabel`);
}

export function formatRouteWarningItem(
  t: TFunction,
  item: import("../../intelligence/types").RouteWarningItem
): string {
  switch (item.kind) {
    case "no_incidents":
      return t("routeIntel.noIncidents");
    case "report_ahead": {
      let line = t("routeIntel.reportAhead", {
        type: reportTypeLabel(t, item.type),
        distance: Math.round(item.distanceM),
      });
      if (item.verified) line += t("routeIntel.reportAheadVerified");
      return line;
    }
    case "high_confidence_clusters":
      return t("routeIntel.highConfidenceClusters", { count: item.count });
    default:
      return "";
  }
}
