export type LiveTrafficSourceKind = "tomtom" | "community";

export type LiveTrafficCategory =
  | "accident"
  | "congestion"
  | "flood"
  | "road_closed"
  | "construction"
  | "lane_closed"
  | "breakdown"
  | "hazard"
  | "weather"
  | "other"
  | "unknown";

export type LiveTrafficTrustLevel = "provider" | "community_unverified";

export type LiveTrafficReport = {
  id: string;
  sourceKind: LiveTrafficSourceKind;
  category: LiveTrafficCategory;
  trustLevel: LiveTrafficTrustLevel;
  severityScore: number;
  magnitudeOfDelay: number | null;
  delaySeconds: number | null;
  lengthMeters: number | null;
  roadName: string | null;
  placeName: string | null;
  lat: number;
  lng: number;
  summary: string | null;
  detailKnown: boolean;
  startedAt: string | null;
  lastUpdatedAt: string | null;
  sourceUrl: string | null;
  mergedSourceLabels: string[];
};

export type LiveTrafficSortMode = "severity" | "newest" | "nearest";

export type LiveTrafficApiResponse = {
  status: "ok" | "stale" | "unavailable";
  fetchedAt: number | null;
  providerTrafficModelId: string | null;
  cacheAgeMs: number | null;
  nextRefreshMs: number;
  incidents: LiveTrafficReport[];
  messageKey: string | null;
};
