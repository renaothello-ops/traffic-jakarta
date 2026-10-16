/** Re-export intelligence types; route snapshot types remain here for navigation hook. */
export type {
  TrafficForecastResult,
  TrafficIntelligenceResult,
  TrafficTextAnalysis,
  TrafficTrendState,
  TrafficTrendResult,
  CommunityTrafficConfidence,
  DataCompletenessFlags as DataCompletenessExtended,
} from "../../../intelligence/types";

export type TrafficTrendValue =
  | "improving"
  | "stable"
  | "worsening"
  | "unknown"
  | null;

export type DataCompleteness = {
  communityDataAvailable: boolean;
  numericTrafficDataAvailable: boolean;
  trafficHistoryAvailable: boolean;
};

export type TrafficIntelligenceSnapshot = {
  segmentId: string;
  timestamp: number;
  trafficSpeed: number | null;
  freeFlowSpeed: number | null;
  congestionRatio: number | null;
  trafficTrend5m: TrafficTrendValue;
  trafficTrend10m: TrafficTrendValue;
  activeReportCount: number;
  accidentReports5m: number;
  heavyTrafficReports5m: number;
  floodReports5m: number;
  roadClosedReports5m: number;
  hazardReports5m: number;
  uniqueConfirmUsers5m: number;
  uniqueDenyUsers5m: number;
  recentVoteCount5m: number;
  recentDenyRatio5m: number | null;
  communityVerifiedReportCount: number;
  freshestReportAgeSeconds: number | null;
  routeAffected: boolean;
  distanceAheadMeters: number | null;
  tomTomTrafficTimestamp: number | null;
  communitySignalTimestamp: number | null;
  communitySignalAgeSeconds: number | null;
  dataCompleteness: DataCompleteness;
};

export type AiTrafficContext = {
  segment: {
    id: string;
    timestamp: number;
  };
  currentTraffic: {
    speedKph: number | null;
    freeFlowSpeedKph: number | null;
    congestionRatio: number | null;
  };
  trafficTrend: {
    fiveMinute: TrafficTrendValue;
    tenMinute: TrafficTrendValue;
  };
  communityReports: {
    activeCount: number;
    accidents5m: number;
    heavyTraffic5m: number;
    floods5m: number;
    roadClosed5m: number;
    hazards5m: number;
    verifiedCount: number;
    freshestAgeSeconds: number | null;
  };
  communityTrust: {
    recentConfirmSignals5m: number;
    recentDenySignals5m: number;
    recentVoteCount5m: number;
    recentDenyRatio5m: number | null;
  };
  routeContext: {
    routeAffected: boolean;
    nearestWarningDistanceMeters: number | null;
  };
  sourceTimestamps: {
    tomTomTrafficTimestamp: number | null;
    communitySignalTimestamp: number | null;
    communitySignalAgeSeconds: number | null;
  };
  dataCompleteness: DataCompleteness;
};
