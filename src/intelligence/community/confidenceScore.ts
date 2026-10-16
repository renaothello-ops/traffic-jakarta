import type {
  CommunityReportSignal,
  CommunityTrafficConfidence,
} from "../types";

const MS_20M = 20 * 60 * 1000;
const MS_60M = 60 * 60 * 1000;

/**
 * Deterministic baseline — replaceable by ML later.
 * Score 0–100: how much community evidence supports active traffic events nearby.
 */
export function computeCommunityTrafficConfidence(
  reports: CommunityReportSignal[],
  now: number = Date.now()
): CommunityTrafficConfidence {
  const factors: string[] = [];
  if (reports.length === 0) {
    return {
      score: 0,
      methodology: "heuristic",
      factors: ["No community reports in range"],
    };
  }

  let score = 0;

  const recent20m = reports.filter((r) => now - r.createdAt <= MS_20M);
  const recent60m = reports.filter((r) => now - r.createdAt <= MS_60M);

  if (recent20m.length > 0) {
    const bump = Math.min(35, 8 + recent20m.length * 4);
    score += bump;
    factors.push(`${recent20m.length} report(s) in last 20 minutes`);
  }

  if (recent60m.length > recent20m.length) {
    score += Math.min(15, (recent60m.length - recent20m.length) * 2);
    factors.push(`${recent60m.length} report(s) in last hour`);
  }

  const verified = reports.filter((r) => r.isCommunityVerified);
  if (verified.length > 0) {
    score += Math.min(25, verified.length * 10);
    factors.push(`${verified.length} community-verified report(s)`);
  }

  let confirmSignals = 0;
  let denySignals = 0;
  for (const r of reports) {
    confirmSignals += r.recentConfirmCount;
    denySignals += r.recentDenyCount;
  }
  if (confirmSignals > 0) {
    score += Math.min(20, confirmSignals * 3);
    factors.push(`${confirmSignals} recent confirm vote(s)`);
  }
  if (denySignals > 0) {
    const penalty = Math.min(30, denySignals * 4);
    score -= penalty;
    factors.push(`${denySignals} recent "not there" vote(s) (reduces score)`);
  }

  const comments = reports.reduce((s, r) => s + r.commentCount, 0);
  if (comments > 0) {
    score += Math.min(10, comments);
    factors.push(`${comments} comment(s) on nearby reports`);
  }

  const severeTypes = new Set([
    "accident",
    "flooded",
    "road_closed",
    "hazard",
  ]);
  const severeCount = reports.filter((r) => severeTypes.has(r.type)).length;
  if (severeCount > 0) {
    score += Math.min(15, severeCount * 5);
    factors.push(`${severeCount} high-severity report type(s)`);
  }

  for (const r of reports) {
    if (r.trustLevel === "hidden_candidate" || r.trustLevel === "very_low_confidence") {
      score -= 12;
      factors.push("Low-trust report suppressed weight");
      break;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    methodology: "heuristic",
    factors,
  };
}
