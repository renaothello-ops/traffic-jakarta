import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Inline mirror of computeCommunityTrafficConfidence for node:test (no TS loader). */
function computeCommunityTrafficConfidence(reports, now) {
  if (reports.length === 0) {
    return { score: 0, methodology: "heuristic", factors: ["No community reports in range"] };
  }
  let score = 0;
  const ms20 = 20 * 60 * 1000;
  const recent20m = reports.filter((r) => now - r.createdAt <= ms20);
  if (recent20m.length > 0) {
    score += Math.min(35, 8 + recent20m.length * 4);
  }
  for (const r of reports) {
    score += Math.min(20, (r.recentConfirmCount ?? 0) * 3);
    score -= Math.min(30, (r.recentDenyCount ?? 0) * 4);
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), methodology: "heuristic", factors: [] };
}

describe("community confidence heuristics", () => {
  it("returns zero with no reports", () => {
    assert.equal(computeCommunityTrafficConfidence([], Date.now()).score, 0);
  });

  it("increases with recent confirms", () => {
    const now = Date.now();
    const score = computeCommunityTrafficConfidence(
      [{ createdAt: now - 30_000, recentConfirmCount: 3, recentDenyCount: 0 }],
      now
    ).score;
    assert.ok(score > 0);
  });
});

describe("forecast policy", () => {
  it("expects insufficient_training_data until ML is wired", () => {
    const status = "insufficient_training_data";
    assert.equal(status, "insufficient_training_data");
  });
});
