import type { NotificationSettings, PostType } from "../../types";
import type { TrafficIntelligenceResult } from "../../intelligence/types";
import { normalizePostType } from "./reportTypes";
import {
  addLocalTrafficNotification,
  locationDedupeBucket,
  timeBucket15Min,
  type LocalTrafficAlertKind,
} from "./localTrafficNotifications";

function postTypeToKind(type: PostType): LocalTrafficAlertKind {
  switch (type) {
    case "accident":
      return "accident";
    case "flooded":
      return "flood";
    case "road_closed":
      return "road_closed";
    case "construction":
      return "construction";
    case "heavy_traffic":
      return "heavy_traffic";
    default:
      return "cluster";
  }
}

function allowsType(settings: NotificationSettings, type: PostType): boolean {
  switch (type) {
    case "accident":
    case "hazard":
      return settings.accidents;
    case "flooded":
      return settings.floods;
    case "road_closed":
      return settings.roadClosures;
    default:
      return settings.trafficAlerts;
  }
}

/** Only notify when there is observed community or numeric traffic data (no empty heuristics). */
function hasRealObservedData(intelligence: TrafficIntelligenceResult): boolean {
  const dc = intelligence.dataCompleteness;
  if (dc.communityDataAvailable && intelligence.nearbyReportCount > 0) return true;
  if (dc.numericTrafficDataAvailable && intelligence.currentTraffic.speedKph != null) {
    return true;
  }
  return intelligence.clusters.some((c) => c.reportCount >= 1);
}

export function syncTrafficIntelligenceAlerts(
  intelligence: TrafficIntelligenceResult | null,
  settings: NotificationSettings
): void {
  if (!intelligence || !settings.master || !settings.trafficAlerts) return;
  if (!hasRealObservedData(intelligence)) return;

  const bucket = locationDedupeBucket(intelligence.location.lat, intelligence.location.lng);
  const timeBucket = timeBucket15Min(intelligence.generatedAt);

  if (
    intelligence.dataCompleteness.communityDataAvailable &&
    intelligence.nearbyReportCount >= 2 &&
    intelligence.trend.trend === "major_incident_detected" &&
    settings.nearbyAlerts
  ) {
    addLocalTrafficNotification({
      kind: "major_incident",
      dedupeKey: `major:${bucket}:${timeBucket}`,
      titleKey: "notifications.trafficAlert.majorTitle",
      bodyKey: "notifications.trafficAlert.nearbyArea",
      sourceLineKey: "notifications.trafficAlert.fromSources",
      lat: intelligence.location.lat,
      lng: intelligence.location.lng,
      reportCount: intelligence.nearbyReportCount,
    });
  }

  if (
    intelligence.trend.trend === "worsening" &&
    intelligence.dataCompleteness.communityDataAvailable &&
    intelligence.nearbyReportCount >= 1
  ) {
    addLocalTrafficNotification({
      kind: "worsening",
      dedupeKey: `worsening:${bucket}:${timeBucket}`,
      titleKey: "notifications.trafficAlert.worseningTitle",
      bodyKey: "notifications.trafficAlert.nearbyArea",
      sourceLineKey: "notifications.trafficAlert.fromSources",
      lat: intelligence.location.lat,
      lng: intelligence.location.lng,
      reportCount: intelligence.nearbyReportCount,
    });
  }

  for (const cluster of intelligence.clusters) {
    if (cluster.reportCount < 2) continue;
    if (cluster.maxConfidence < 40) continue;

    const dominant = normalizePostType(cluster.dominantType) as PostType;
    if (!allowsType(settings, dominant)) continue;

    const kind = postTypeToKind(dominant);
    addLocalTrafficNotification({
      kind,
      dedupeKey: `cluster:${cluster.id}:${timeBucket}`,
      titleKey: "notifications.trafficAlert.clusterTitle",
      bodyKey: "notifications.trafficAlert.reportCount",
      bodyParams: { count: cluster.reportCount },
      subtitleKey: "notifications.trafficAlert.nearbyArea",
      sourceLineKey: "notifications.trafficAlert.fromSources",
      lat: cluster.lat,
      lng: cluster.lng,
      dominantType: dominant,
      reportCount: cluster.reportCount,
      clusterId: cluster.id,
    });
  }
}
