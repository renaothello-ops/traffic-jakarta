import type { EnrichedPost } from "../../assets/lib/trust";
import {
  projectRouteReports,
  type RouteReportProjection,
} from "../../assets/lib/navigation/routeReports";
import { clusterNearbyReports } from "../community/clusterReports";
import { enrichedPostToSignal } from "../trafficFusion/fuseTrafficIntelligence";
import type { IncidentClusterSummary, RouteWarningItem } from "../types";
import type { RouteIntelligenceSummary } from "../types";

export function summarizeRouteIntelligence(input: {
  posts: EnrichedPost[];
  routeCoordinates: Array<[number, number]>;
  filterMin: number;
  now?: number;
}): RouteIntelligenceSummary & { projections: RouteReportProjection[] } {
  const now = input.now ?? Date.now();
  const projections = projectRouteReports(
    input.posts,
    input.routeCoordinates,
    { filterMin: input.filterMin, now }
  );

  const warningItems: RouteWarningItem[] = [];
  if (projections.length === 0) {
    return {
      incidentCountOnRoute: 0,
      highConfidenceClusterCount: 0,
      warningItems: [{ kind: "no_incidents" }],
      methodology: "heuristic",
      projections,
    };
  }

  const signals = projections
    .map((p) => input.posts.find((x) => x.id === p.postId))
    .filter((post): post is EnrichedPost => post != null)
    .map((post) => enrichedPostToSignal(post, 0));

  const clusters = clusterNearbyReports(signals, 400, now);
  const highConfidenceClusterCount = clusters.filter(
    (c: IncidentClusterSummary) => c.maxConfidence >= 50 && c.reportCount >= 2
  ).length;

  for (const p of projections.slice(0, 5)) {
    warningItems.push({
      kind: "report_ahead",
      type: p.type,
      distanceM: p.distanceAheadMeters,
      verified: p.isCommunityVerified,
    });
  }

  if (highConfidenceClusterCount > 0) {
    warningItems.push({
      kind: "high_confidence_clusters",
      count: highConfidenceClusterCount,
    });
  }

  return {
    incidentCountOnRoute: projections.length,
    highConfidenceClusterCount,
    warningItems,
    methodology: "heuristic",
    projections,
  };
}
