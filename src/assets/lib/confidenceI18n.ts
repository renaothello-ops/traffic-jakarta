import type { TFunction } from "i18next";
import type { ConfidenceStatus } from "../../types";

export function confidenceLabelI18n(
  t: TFunction,
  status: ConfidenceStatus
): string {
  switch (status) {
    case "community_verified":
      return t("trust.communityVerified");
    case "community_reported":
      return t("trust.communityReported");
    case "possibly_outdated":
      return t("trust.possiblyOutdated");
    default:
      return t("trust.unverified");
  }
}
