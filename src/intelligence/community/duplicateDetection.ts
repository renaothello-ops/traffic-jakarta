import { haversineMeters } from "../../assets/lib/geo";
import type { CommunityReportSignal } from "../types";

const DUPLICATE_DISTANCE_M = 120;
const DUPLICATE_TIME_MS = 25 * 60 * 1000;

export type DuplicateReportHint = {
  postId: string;
  similarToPostId: string;
  distanceMeters: number;
  reason: string;
};

/**
 * Flags likely duplicate reports (same area + similar type + close in time).
 * Does not block posting — UI can suggest merging / confirming instead.
 */
export function detectLikelyDuplicateReports(
  target: CommunityReportSignal,
  others: CommunityReportSignal[]
): DuplicateReportHint | null {
  for (const other of others) {
    if (other.postId === target.postId) continue;
    if (other.type !== target.type && !relatedTypes(other.type, target.type)) {
      continue;
    }
    const dt = Math.abs(other.createdAt - target.createdAt);
    if (dt > DUPLICATE_TIME_MS) continue;
    const dist = haversineMeters(
      target.lat,
      target.lng,
      other.lat,
      other.lng
    );
    if (dist <= DUPLICATE_DISTANCE_M) {
      return {
        postId: target.postId,
        similarToPostId: other.postId,
        distanceMeters: Math.round(dist),
        reason: "Same report type within ~120 m and 25 minutes",
      };
    }
  }
  return null;
}

function relatedTypes(a: string, b: string): boolean {
  const congestion = new Set(["heavy_traffic", "hazard", "construction"]);
  return congestion.has(a) && congestion.has(b);
}

export function spamLikelihoodScore(
  report: CommunityReportSignal,
  duplicatesNearby: number
): number {
  let score = 0;
  if (report.trustLevel === "hidden_candidate") score += 70;
  else if (report.trustLevel === "very_low_confidence") score += 45;
  else if (report.trustLevel === "low_confidence") score += 25;
  if (report.recentDenyCount >= 3) score += 20;
  if (duplicatesNearby >= 2) score += 15;
  return Math.min(100, score);
}
