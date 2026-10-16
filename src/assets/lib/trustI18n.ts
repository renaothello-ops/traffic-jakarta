import type { TFunction } from "i18next";
import type { TrustLevel } from "./trust";

export function publicTrustLabelI18n(
  t: TFunction,
  confirmCount: number,
  trustLevel: TrustLevel,
  isCommunityVerified = false
): string {
  if (trustLevel === "low_confidence" || trustLevel === "very_low_confidence") {
    return t("trust.lowConfidence");
  }
  if (isCommunityVerified) return t("trust.communityVerified");
  if (confirmCount >= 3) return t("trust.communityReported");
  return t("trust.unverified");
}
