import type { PostType } from "../types";

/** Shared intelligence types — distinguish REAL / HEURISTIC / ML / LLM in `methodology`. */

export type IntelligenceMethodology =
  | "real_observed"
  | "heuristic"
  | "trained_ml"
  | "llm"
  | "unavailable";

export type TrafficTextCategory =
  | "accident"
  | "flood"
  | "construction"
  | "closure"
  | "congestion"
  | "clear"
  | "other";

export type TrafficTextAnalysis = {
  category: TrafficTextCategory;
  severity: number;
  confidence: number;
  extractedLocation?: string;
  summary?: string;
  methodology: IntelligenceMethodology;
  provider: "rule_based" | "llm" | "hybrid";
};

export type CommunityTrafficConfidence = {
  score: number;
  methodology: "heuristic";
  factors: string[];
};

export type TrafficTrendState =
  | "improving"
  | "stable"
  | "worsening"
  | "major_incident_detected";

export type TrafficTrendResult = {
  trend: TrafficTrendState;
  methodology: "heuristic";
  signals: string[];
};

export type ForecastStatus =
  | "insufficient_training_data"
  | "baseline_heuristic_only"
  | "ready_for_ml";

export type PredictedTrafficState =
  | "free_flow"
  | "moderate"
  | "heavy"
  | "severe"
  | "unknown";

export type TrafficForecastResult = {
  horizonMinutes: 15 | 30;
  predictedState: PredictedTrafficState;
  confidence: number | null;
  modelType: "none" | "heuristic_baseline" | "xgboost";
  status: ForecastStatus;
  inputsUsed: string[];
  generatedAt: number;
  dataCompleteness: number;
  explanation: string;
  methodology: IntelligenceMethodology;
};

export type DataCompletenessFlags = {
  communityDataAvailable: boolean;
  numericTrafficDataAvailable: boolean;
  trafficHistoryAvailable: boolean;
  commentDataAvailable: boolean;
  weatherDataAvailable: boolean;
  timeContextAvailable: boolean;
};

export type ExplanationPart = {
  key: string;
  params?: Record<string, string | number | boolean>;
};

export type TrafficIntelligenceResult = {
  location: { lat: number; lng: number };
  currentTraffic: {
    speedKph: number | null;
    freeFlowSpeedKph: number | null;
    congestionRatio: number | null;
    tomTomRasterVisible: boolean;
  };
  communityConfidence: CommunityTrafficConfidence;
  incidentScore: number;
  congestionSeverityScore: number;
  trend: TrafficTrendResult;
  forecasts: TrafficForecastResult[];
  explanation: string;
  explanationParts: ExplanationPart[];
  dataSources: string[];
  generatedAt: number;
  dataCompleteness: DataCompletenessFlags;
  methodology: IntelligenceMethodology;
  clusters: IncidentClusterSummary[];
  nearbyReportCount: number;
};

export type IncidentClusterSummary = {
  id: string;
  lat: number;
  lng: number;
  reportCount: number;
  dominantType: string;
  maxConfidence: number;
  radiusMeters: number;
};

export type CommunityReportSignal = {
  postId: string;
  type: string;
  lat: number;
  lng: number;
  createdAt: number;
  text: string;
  confirmCount: number;
  denyCount: number;
  recentConfirmCount: number;
  recentDenyCount: number;
  isCommunityVerified: boolean;
  trustLevel: string;
  commentCount: number;
};

export type TomTomLiveNumeric = {
  currentSpeedKph: number | null;
  freeFlowSpeedKph: number | null;
  confidence: number | null;
  roadClosure: boolean | null;
  observedAt: number | null;
};

export type TimeContext = {
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isPublicHoliday: boolean;
  holidayName: string | null;
  timezone: string;
};

export type RouteWarningItem =
  | { kind: "no_incidents" }
  | {
      kind: "report_ahead";
      type: PostType;
      distanceM: number;
      verified: boolean;
    }
  | { kind: "high_confidence_clusters"; count: number };

export type RouteIntelligenceSummary = {
  incidentCountOnRoute: number;
  highConfidenceClusterCount: number;
  warningItems: RouteWarningItem[];
  methodology: "heuristic";
};
