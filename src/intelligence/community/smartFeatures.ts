import type { EnrichedPost } from "../../assets/lib/trust";
import { haversineMeters } from "../../assets/lib/geo";
import { detectLikelyDuplicateReports, spamLikelihoodScore } from "./duplicateDetection";
import { enrichedPostToSignal } from "../trafficFusion/fuseTrafficIntelligence";
import { computeCommunityTrafficConfidence } from "./confidenceScore";

export type TrendingIncident = {
  postId: string;
  type: string;
  score: number;
  reason: string;
};

export function rankTrendingIncidents(
  posts: EnrichedPost[],
  now: number = Date.now()
): TrendingIncident[] {
  const ms30 = 30 * 60 * 1000;
  return posts
    .filter((p) => now - p.createdAt <= ms30)
    .map((p) => {
      const signal = enrichedPostToSignal(p, 0);
      const conf = computeCommunityTrafficConfidence([signal], now);
      let score = conf.score;
      score += p.recentConfirmCount * 5;
      if (p.isCommunityVerified) score += 15;
      return {
        postId: p.id,
        type: p.type,
        score,
        reason: "Recent activity + community votes",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export function findDuplicateHints(
  posts: EnrichedPost[],
  radiusMeters: number = 2000
): ReturnType<typeof detectLikelyDuplicateReports>[] {
  const hints: ReturnType<typeof detectLikelyDuplicateReports>[] = [];
  for (const post of posts) {
    const neighbors = posts.filter(
      (o) =>
        o.id !== post.id &&
        haversineMeters(post.lat, post.lng, o.lat, o.lng) <= radiusMeters
    );
    const signal = enrichedPostToSignal(post, 0);
    const others = neighbors.map((n) => enrichedPostToSignal(n, 0));
    const hint = detectLikelyDuplicateReports(signal, others);
    if (hint) hints.push(hint);
  }
  return hints;
}

export function reportReliabilityScore(post: EnrichedPost): number {
  const dupCount = 0;
  const spam = spamLikelihoodScore(enrichedPostToSignal(post, 0), dupCount);
  return Math.max(0, Math.min(100, 100 - spam + post.confirmCount * 2));
}
