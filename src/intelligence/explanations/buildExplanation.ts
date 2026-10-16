import type {
  CommunityTrafficConfidence,
  ExplanationPart,
  TomTomLiveNumeric,
  TrafficTrendResult,
} from "../types";

export function buildIntelligenceExplanationParts(input: {
  nearbyReportCount: number;
  recent20mCount: number;
  communityConfidence: CommunityTrafficConfidence;
  tomtom: TomTomLiveNumeric | null;
  tomTomRasterVisible: boolean;
  trend: TrafficTrendResult;
}): ExplanationPart[] {
  const parts: ExplanationPart[] = [];

  if (
    input.tomtom?.currentSpeedKph != null &&
    input.tomtom.freeFlowSpeedKph != null
  ) {
    parts.push({
      key: "smartTraffic.explain.tomtomSpeed",
      params: {
        current: Math.round(input.tomtom.currentSpeedKph),
        freeFlow: Math.round(input.tomtom.freeFlowSpeedKph),
      },
    });
  } else if (input.tomTomRasterVisible) {
    parts.push({ key: "smartTraffic.explain.tomtomRasterOnly" });
  }

  if (input.recent20mCount > 0) {
    parts.push({
      key: "smartTraffic.explain.recentReports",
      params: {
        recent: input.recent20mCount,
        total: input.nearbyReportCount,
        count: input.recent20mCount,
      },
    });
  } else if (input.nearbyReportCount > 0) {
    parts.push({
      key: "smartTraffic.explain.nearbyNoRecent",
      params: { total: input.nearbyReportCount, count: input.nearbyReportCount },
    });
  } else {
    parts.push({ key: "smartTraffic.explain.noCommunity" });
  }

  if (input.communityConfidence.score > 0) {
    parts.push({
      key: "smartTraffic.explain.confidenceScore",
      params: { score: input.communityConfidence.score },
    });
  }

  if (input.trend.trend === "major_incident_detected") {
    parts.push({ key: "smartTraffic.explain.trendMajor" });
  } else if (input.trend.trend === "worsening") {
    parts.push({ key: "smartTraffic.explain.trendWorsening" });
  } else if (input.trend.trend === "improving") {
    parts.push({ key: "smartTraffic.explain.trendImproving" });
  }

  return parts;
}

/** Legacy English join for dev tooling only. */
export function buildIntelligenceExplanation(input: {
  nearbyReportCount: number;
  recent20mCount: number;
  communityConfidence: CommunityTrafficConfidence;
  tomtom: TomTomLiveNumeric | null;
  tomTomRasterVisible: boolean;
  trend: TrafficTrendResult;
}): string {
  const parts = buildIntelligenceExplanationParts(input);
  return parts.map((p) => `${p.key}${p.params ? JSON.stringify(p.params) : ""}`).join(" ");
}

export function formatExplanationParts(
  t: (key: string, opts?: Record<string, unknown>) => string,
  parts: ExplanationPart[]
): string {
  return parts.map((p) => t(p.key, p.params)).join(" ");
}
