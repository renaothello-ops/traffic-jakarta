import type { UserProfile } from "../../types";
import { getPublishedTermsVersion, requiresPublishedTermsAcceptance } from "./legal";

/** Accounts created before this instant skip onboardingCompletedAt (legacy users). */
export const ONBOARDING_REQUIRED_AFTER_MS = Date.parse(
  "2026-10-21T00:00:00.000Z"
);

export function needsOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return true;
  if (!profile.displayName.trim() || !profile.usernameLower) return true;

  const published = getPublishedTermsVersion();
  if (published && profile.termsAcceptedVersion !== published) return true;

  if (profile.onboardingCompletedAt) return false;

  if (profile.createdAt < ONBOARDING_REQUIRED_AFTER_MS) return false;

  if (published) {
    return !profile.termsAcceptedAt;
  }
  return !profile.privacyNoticeAcknowledgedAt;
}

export function onboardingBlockingReason(
  profile: UserProfile | null
): "auth" | "displayName" | "username" | "terms" | null {
  if (!profile) return "auth";
  if (!profile.displayName.trim()) return "displayName";
  if (!profile.usernameLower) return "username";
  if (requiresPublishedTermsAcceptance()) {
    const published = getPublishedTermsVersion();
    if (published && profile.termsAcceptedVersion !== published) return "terms";
  }
  return null;
}
