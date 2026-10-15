import type { Post } from "../../types";
import { countVotes } from "./votes";
import type { Vote } from "../../types";

/** Recent confirms/denies must fall within this window to count. */
export const VERIFICATION_WINDOW_MS = 5 * 60 * 1000;

export type TrustLevel =
  | "normal"
  | "low_confidence"
  | "very_low_confidence"
  | "hidden_candidate";

export type ConfirmMarkerTier = 0 | 1 | 2 | 3;
export type VerificationTier = 0 | 1 | 2 | 3;

export type PostVoteStats = {
  confirmCount: number;
  denyCount: number;
  recentConfirmCount: number;
  recentDenyCount: number;
  trustLevel: TrustLevel;
  trustScore: number;
  confirmTier: ConfirmMarkerTier;
  verificationTier: VerificationTier;
  /** Map/feed tier after low-confidence suppression. */
  displayVerificationTier: VerificationTier;
  isCommunityVerified: boolean;
};

export function computeTrustLevel(
  confirmCount: number,
  denyCount: number
): TrustLevel {
  const totalVotes = confirmCount + denyCount;
  const denyRatio = totalVotes > 0 ? denyCount / totalVotes : 0;

  if (denyCount >= 8 && denyRatio >= 0.8) return "hidden_candidate";
  if (denyCount >= 5 && denyRatio >= 0.7) return "very_low_confidence";
  if (denyCount >= 3 && denyRatio >= 0.6) return "low_confidence";
  return "normal";
}

export function computeTrustScore(
  confirmCount: number,
  denyCount: number
): number {
  return confirmCount - denyCount * 2;
}

export function computeConfirmTier(confirmCount: number): ConfirmMarkerTier {
  if (confirmCount >= 15) return 3;
  if (confirmCount >= 6) return 2;
  if (confirmCount >= 3) return 1;
  return 0;
}

/** Count unique authenticated voters within the verification window. */
export function countRecentVotes(
  votes: Vote[],
  now: number,
  windowMs: number = VERIFICATION_WINDOW_MS
): { recentConfirmCount: number; recentDenyCount: number } {
  const cutoff = now - windowMs;
  const confirmUids = new Set<string>();
  const denyUids = new Set<string>();

  for (const v of votes) {
    if (v.createdAt < cutoff) continue;
    const uid = v.voterId;
    if (!uid) continue;
    if (v.vote === "confirm") confirmUids.add(uid);
    else if (v.vote === "deny") denyUids.add(uid);
  }

  return {
    recentConfirmCount: confirmUids.size,
    recentDenyCount: denyUids.size,
  };
}

export function computeVerificationTier(
  recentConfirmCount: number
): VerificationTier {
  if (recentConfirmCount >= 10) return 3;
  if (recentConfirmCount >= 5) return 2;
  if (recentConfirmCount >= 3) return 1;
  return 0;
}

/** Suppress verified visuals when lifetime or recent denies hit trust thresholds. */
export function verificationSuppressed(
  lifetimeTrustLevel: TrustLevel,
  recentConfirmCount: number,
  recentDenyCount: number
): boolean {
  if (
    lifetimeTrustLevel === "low_confidence" ||
    lifetimeTrustLevel === "very_low_confidence" ||
    lifetimeTrustLevel === "hidden_candidate"
  ) {
    return true;
  }

  const recentTrust = computeTrustLevel(recentConfirmCount, recentDenyCount);
  return (
    recentTrust === "low_confidence" ||
    recentTrust === "very_low_confidence" ||
    recentTrust === "hidden_candidate"
  );
}

export function buildPostVoteStats(
  votes: Vote[],
  now: number = Date.now()
): PostVoteStats {
  const { confirmCount, denyCount } = countVotes(votes);
  const { recentConfirmCount, recentDenyCount } = countRecentVotes(votes, now);
  const trustLevel = computeTrustLevel(confirmCount, denyCount);
  const verificationTier = computeVerificationTier(recentConfirmCount);
  const suppressed = verificationSuppressed(
    trustLevel,
    recentConfirmCount,
    recentDenyCount
  );
  const displayVerificationTier = suppressed ? 0 : verificationTier;
  const isCommunityVerified = !suppressed && verificationTier >= 2;

  return {
    confirmCount,
    denyCount,
    recentConfirmCount,
    recentDenyCount,
    trustLevel,
    trustScore: computeTrustScore(confirmCount, denyCount),
    confirmTier: computeConfirmTier(confirmCount),
    verificationTier,
    displayVerificationTier,
    isCommunityVerified,
  };
}

export function isHiddenFromPublicFeed(trustLevel: TrustLevel): boolean {
  return trustLevel === "hidden_candidate";
}

export function trustMarkerOpacity(
  trustLevel: TrustLevel,
  baseOpacity: number
): number {
  switch (trustLevel) {
    case "low_confidence":
      return baseOpacity * 0.78;
    case "very_low_confidence":
      return baseOpacity * 0.58;
    case "hidden_candidate":
      return baseOpacity * 0.4;
    default:
      return baseOpacity;
  }
}

/** Public-facing status — never exposes deny counts. */
export function publicTrustLabel(
  confirmCount: number,
  trustLevel: TrustLevel,
  isCommunityVerified = false
): string {
  if (trustLevel === "low_confidence" || trustLevel === "very_low_confidence") {
    return "Low confidence";
  }
  if (isCommunityVerified) return "✓ Community verified";
  if (confirmCount >= 3) return "Community reported";
  return "Unverified";
}

export type EnrichedPost = Post & PostVoteStats;

export function enrichPostWithVotes(
  post: Post,
  votes: Vote[],
  now: number = Date.now()
): EnrichedPost {
  return { ...post, ...buildPostVoteStats(votes, now) };
}
