import type { RouteReportProjection } from "../navigation/routeReports";
import { RECENT_VOTE_WINDOW_MS } from "../navigation/routeReportConfig";
import type {
  AiTrafficContext,
  TrafficIntelligenceSnapshot,
  TrafficTrendValue,
} from "./types";
import {
  computeCongestionRatio,
  type TomTomNumericTraffic,
} from "./tomtomAdapter";

const FIVE_MIN_MS = RECENT_VOTE_WINDOW_MS;

function countRecentByType(
  projections: RouteReportProjection[],
  type: RouteReportProjection["type"],
  now: number,
  createdAtById: Map<string, number>
): number {
  let count = 0;
  for (const p of projections) {
    if (p.type !== type) continue;
    const createdAt = createdAtById.get(p.postId);
    if (createdAt == null) continue;
    if (now - createdAt <= FIVE_MIN_MS) count += 1;
  }
  return count;
}

export type BuildTrafficIntelligenceInput = {
  segmentId: string;
  timestamp: number;
  aheadReports: RouteReportProjection[];
  createdAtById: Map<string, number>;
  tomtom?: TomTomNumericTraffic | null;
  routeAffected: boolean;
  nearestWarningDistanceMeters: number | null;
  trafficTrend5m?: TrafficTrendValue;
  trafficTrend10m?: TrafficTrendValue;
};

export function buildTrafficIntelligenceSnapshot(
  input: BuildTrafficIntelligenceInput
): TrafficIntelligenceSnapshot {
  const {
    segmentId,
    timestamp,
    aheadReports,
    createdAtById,
    tomtom,
    routeAffected,
    nearestWarningDistanceMeters,
  } = input;

  const trafficSpeed = tomtom?.currentSpeedKph ?? null;
  const freeFlowSpeed = tomtom?.freeFlowSpeedKph ?? null;
  const congestionRatio = computeCongestionRatio(trafficSpeed, freeFlowSpeed);

  const numericTrafficDataAvailable =
    trafficSpeed != null || freeFlowSpeed != null;
  const trafficHistoryAvailable = false;

  let uniqueConfirmUsers5m = 0;
  let uniqueDenyUsers5m = 0;
  let recentVoteCount5m = 0;
  let communityVerifiedReportCount = 0;
  let freshestReportAgeSeconds: number | null = null;

  for (const report of aheadReports) {
    uniqueConfirmUsers5m += report.recentConfirmCount5m;
    uniqueDenyUsers5m += report.recentDenyCount5m;
    recentVoteCount5m += report.recentVoteCount5m;
    if (report.isCommunityVerified) communityVerifiedReportCount += 1;
    freshestReportAgeSeconds =
      freshestReportAgeSeconds == null
        ? report.reportAgeSeconds
        : Math.min(freshestReportAgeSeconds, report.reportAgeSeconds);
  }

  const recentDenyRatio5m =
    recentVoteCount5m > 0 ? uniqueDenyUsers5m / recentVoteCount5m : null;

  return {
    segmentId,
    timestamp,
    trafficSpeed,
    freeFlowSpeed,
    congestionRatio,
    trafficTrend5m: input.trafficTrend5m ?? null,
    trafficTrend10m: input.trafficTrend10m ?? null,
    activeReportCount: aheadReports.length,
    accidentReports5m: countRecentByType(
      aheadReports,
      "accident",
      timestamp,
      createdAtById
    ),
    heavyTrafficReports5m: countRecentByType(
      aheadReports,
      "heavy_traffic",
      timestamp,
      createdAtById
    ),
    floodReports5m: countRecentByType(
      aheadReports,
      "flooded",
      timestamp,
      createdAtById
    ),
    roadClosedReports5m: countRecentByType(
      aheadReports,
      "road_closed",
      timestamp,
      createdAtById
    ),
    hazardReports5m: countRecentByType(
      aheadReports,
      "hazard",
      timestamp,
      createdAtById
    ),
    uniqueConfirmUsers5m,
    uniqueDenyUsers5m,
    recentVoteCount5m,
    recentDenyRatio5m,
    communityVerifiedReportCount,
    freshestReportAgeSeconds,
    routeAffected,
    distanceAheadMeters: nearestWarningDistanceMeters,
    tomTomTrafficTimestamp: null,
    communitySignalTimestamp:
      aheadReports.length > 0 ? timestamp : null,
    communitySignalAgeSeconds: freshestReportAgeSeconds,
    dataCompleteness: {
      communityDataAvailable: aheadReports.length > 0,
      numericTrafficDataAvailable,
      trafficHistoryAvailable,
    },
  };
}

/** Privacy-safe payload for a future /api/ai/traffic-intelligence endpoint. */
export function buildAiTrafficContext(
  snapshot: TrafficIntelligenceSnapshot
): AiTrafficContext {
  return {
    segment: {
      id: snapshot.segmentId,
      timestamp: snapshot.timestamp,
    },
    currentTraffic: {
      speedKph: snapshot.trafficSpeed,
      freeFlowSpeedKph: snapshot.freeFlowSpeed,
      congestionRatio: snapshot.congestionRatio,
    },
    trafficTrend: {
      fiveMinute: snapshot.trafficTrend5m,
      tenMinute: snapshot.trafficTrend10m,
    },
    communityReports: {
      activeCount: snapshot.activeReportCount,
      accidents5m: snapshot.accidentReports5m,
      heavyTraffic5m: snapshot.heavyTrafficReports5m,
      floods5m: snapshot.floodReports5m,
      roadClosed5m: snapshot.roadClosedReports5m,
      hazards5m: snapshot.hazardReports5m,
      verifiedCount: snapshot.communityVerifiedReportCount,
      freshestAgeSeconds: snapshot.freshestReportAgeSeconds,
    },
    communityTrust: {
      recentConfirmSignals5m: snapshot.uniqueConfirmUsers5m,
      recentDenySignals5m: snapshot.uniqueDenyUsers5m,
      recentVoteCount5m: snapshot.recentVoteCount5m,
      recentDenyRatio5m: snapshot.recentDenyRatio5m,
    },
    routeContext: {
      routeAffected: snapshot.routeAffected,
      nearestWarningDistanceMeters: snapshot.distanceAheadMeters,
    },
    sourceTimestamps: {
      tomTomTrafficTimestamp: snapshot.tomTomTrafficTimestamp,
      communitySignalTimestamp: snapshot.communitySignalTimestamp,
      communitySignalAgeSeconds: snapshot.communitySignalAgeSeconds,
    },
    dataCompleteness: snapshot.dataCompleteness,
  };
}
