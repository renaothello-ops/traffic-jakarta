import { haversineMeters } from "../../assets/lib/geo";
import type { EnrichedPost } from "../../assets/lib/trust";
import { clusterNearbyReports } from "../community/clusterReports";
import { computeCommunityTrafficConfidence } from "../community/confidenceScore";
import {
  buildIntelligenceExplanation,
  buildIntelligenceExplanationParts,
} from "../explanations/buildExplanation";
import { buildTrafficForecasts } from "../forecast/buildForecast";
import { buildTimeContext } from "../timeContext";
import { detectTrafficTrend } from "../trend/detectTrend";
import type {
  CommunityReportSignal,
  DataCompletenessFlags,
  TomTomLiveNumeric,
  TrafficIntelligenceResult,
} from "../types";

export type FuseTrafficIntelligenceInput = {
  lat: number;
  lng: number;
  radiusMeters: number;
  posts: EnrichedPost[];
  commentCountByPostId?: Record<string, number>;
  tomtom: TomTomLiveNumeric | null;
  tomTomRasterVisible: boolean;
  now?: number;
};

export function enrichedPostToSignal(
  post: EnrichedPost,
  commentCount: number
): CommunityReportSignal {
  return {
    postId: post.id,
    type: post.type,
    lat: post.lat,
    lng: post.lng,
    createdAt: post.createdAt,
    text: post.text ?? "",
    confirmCount: post.confirmCount,
    denyCount: post.denyCount,
    recentConfirmCount: post.recentConfirmCount,
    recentDenyCount: post.recentDenyCount,
    isCommunityVerified: post.isCommunityVerified,
    trustLevel: post.trustLevel,
    commentCount,
  };
}

export function fuseTrafficIntelligence(
  input: FuseTrafficIntelligenceInput
): TrafficIntelligenceResult {
  const now = input.now ?? Date.now();
  const ms20 = 20 * 60 * 1000;

  const nearby = input.posts.filter((p) => {
    const d = haversineMeters(input.lat, input.lng, p.lat, p.lng);
    return d <= input.radiusMeters;
  });

  const signals = nearby.map((p) =>
    enrichedPostToSignal(
      p,
      input.commentCountByPostId?.[p.id] ?? 0
    )
  );

  const recent20m = signals.filter((s) => now - s.createdAt <= ms20);
  const communityConfidence = computeCommunityTrafficConfidence(signals, now);
  const clusters = clusterNearbyReports(signals, 500, now);
  const time = buildTimeContext(now);
  const trend = detectTrafficTrend({
    reports: signals,
    tomtom: input.tomtom,
    now,
  });

  const ratio =
    input.tomtom?.currentSpeedKph != null &&
    input.tomtom?.freeFlowSpeedKph != null &&
    input.tomtom.freeFlowSpeedKph > 0
      ? input.tomtom.currentSpeedKph / input.tomtom.freeFlowSpeedKph
      : null;

  let congestionSeverityScore = 0;
  if (ratio != null) {
    congestionSeverityScore = Math.round(Math.max(0, Math.min(100, (1 - ratio) * 100)));
  } else if (recent20m.some((r) => r.type === "heavy_traffic")) {
    congestionSeverityScore = 55;
  }

  let incidentScore = 0;
  const incidentTypes = new Set(["accident", "flooded", "road_closed", "hazard"]);
  const incidents = signals.filter((s) => incidentTypes.has(s.type));
  incidentScore = Math.min(
    100,
    incidents.length * 18 +
      incidents.filter((s) => now - s.createdAt <= ms20).length * 12 +
      communityConfidence.score * 0.25
  );

  const commentDataAvailable = Object.keys(
    input.commentCountByPostId ?? {}
  ).some((id) => nearby.some((p) => p.id === id));

  const dataCompleteness: DataCompletenessFlags = {
    communityDataAvailable: signals.length > 0,
    numericTrafficDataAvailable:
      input.tomtom?.currentSpeedKph != null ||
      input.tomtom?.freeFlowSpeedKph != null,
    trafficHistoryAvailable: false,
    commentDataAvailable,
    weatherDataAvailable: false,
    timeContextAvailable: true,
  };

  const dataSources: string[] = [];
  if (input.tomTomRasterVisible) dataSources.push("tomtom_raster");
  if (dataCompleteness.numericTrafficDataAvailable) {
    dataSources.push("tomtom_flow_segment_live");
  }
  if (signals.length > 0) dataSources.push("firebase_community_reports");
  if (commentDataAvailable) dataSources.push("firebase_comments");
  dataSources.push("time_context_jakarta");

  const forecasts = buildTrafficForecasts({
    reports: signals,
    tomtom: input.tomtom,
    time,
    now,
  });

  const explanationInput = {
    nearbyReportCount: signals.length,
    recent20mCount: recent20m.length,
    communityConfidence,
    tomtom: input.tomtom,
    tomTomRasterVisible: input.tomTomRasterVisible,
    trend,
  };
  const explanationParts = buildIntelligenceExplanationParts(explanationInput);
  const explanation = buildIntelligenceExplanation(explanationInput);

  return {
    location: { lat: input.lat, lng: input.lng },
    currentTraffic: {
      speedKph: input.tomtom?.currentSpeedKph ?? null,
      freeFlowSpeedKph: input.tomtom?.freeFlowSpeedKph ?? null,
      congestionRatio: ratio,
      tomTomRasterVisible: input.tomTomRasterVisible,
    },
    communityConfidence,
    incidentScore: Math.round(incidentScore),
    congestionSeverityScore,
    trend,
    forecasts,
    explanation,
    explanationParts,
    dataSources,
    generatedAt: now,
    dataCompleteness,
    methodology: "heuristic",
    clusters,
    nearbyReportCount: signals.length,
  };
}
