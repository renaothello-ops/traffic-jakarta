import type { Post } from "../../../types";
import type { LiveTrafficReport, LiveTrafficSortMode } from "./types";
import { sanitizeExternalUrl } from "./safeExternalUrl";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function postTypeToCategory(type: Post["type"]): LiveTrafficReport["category"] {
  const map: Record<Post["type"], LiveTrafficReport["category"]> = {
    accident: "accident",
    road_closed: "road_closed",
    heavy_traffic: "congestion",
    flooded: "flood",
    construction: "construction",
    hazard: "hazard",
    car_passable: "congestion",
    motorcycle_only: "congestion",
    other: "other",
  };
  return map[type] ?? "other";
}

const LIVE_POST_TYPES = new Set<Post["type"]>([
  "accident",
  "road_closed",
  "heavy_traffic",
  "flooded",
  "construction",
  "hazard",
]);

export function communityPostsToLiveReports(
  posts: Post[],
  maxAgeMs: number,
  now = Date.now()
): LiveTrafficReport[] {
  return posts
    .filter((p) => LIVE_POST_TYPES.has(p.type))
    .filter((p) => now - p.createdAt <= maxAgeMs)
    .map((p) => {
      const confirms = p.confirmCount ?? 0;
      const denies = p.denyCount ?? 0;
      const severityScore = Math.min(72, 28 + Math.max(0, confirms - denies) * 6);
      const text = p.text?.trim() || null;
      return {
        id: `community:${p.id}`,
        sourceKind: "community",
        category: postTypeToCategory(p.type),
        trustLevel: "community_unverified",
        severityScore,
        magnitudeOfDelay: null,
        delaySeconds: null,
        lengthMeters: null,
        roadName: null,
        placeName: null,
        lat: p.lat,
        lng: p.lng,
        summary: text,
        detailKnown: Boolean(text),
        startedAt: new Date(p.createdAt).toISOString(),
        lastUpdatedAt: new Date(p.createdAt).toISOString(),
        sourceUrl: null,
        mergedSourceLabels: ["Traffic Jakarta"],
      } satisfies LiveTrafficReport;
    });
}

export function dedupeLiveReports(reports: LiveTrafficReport[]): LiveTrafficReport[] {
  const out: LiveTrafficReport[] = [];
  for (const r of reports) {
    let merged = false;
    for (const existing of out) {
      if (existing.category !== r.category) continue;
      if (haversineMeters(existing.lat, existing.lng, r.lat, r.lng) > 450) continue;
      existing.mergedSourceLabels = [
        ...new Set([...existing.mergedSourceLabels, ...r.mergedSourceLabels]),
      ];
      if (r.severityScore > existing.severityScore) {
        existing.severityScore = r.severityScore;
        existing.summary = r.summary ?? existing.summary;
        existing.delaySeconds = r.delaySeconds ?? existing.delaySeconds;
        existing.lengthMeters = r.lengthMeters ?? existing.lengthMeters;
      }
      if (
        r.lastUpdatedAt &&
        (!existing.lastUpdatedAt || r.lastUpdatedAt > existing.lastUpdatedAt)
      ) {
        existing.lastUpdatedAt = r.lastUpdatedAt;
      }
      merged = true;
      break;
    }
    if (!merged) {
      out.push({ ...r, mergedSourceLabels: [...r.mergedSourceLabels] });
    }
  }
  return out;
}

export function sortLiveReports(
  reports: LiveTrafficReport[],
  mode: LiveTrafficSortMode,
  refLat?: number | null,
  refLng?: number | null
): LiveTrafficReport[] {
  const list = [...reports];
  if (mode === "severity") {
    list.sort((a, b) => b.severityScore - a.severityScore);
  } else if (mode === "newest") {
    list.sort((a, b) => {
      const ta = Date.parse(a.lastUpdatedAt ?? a.startedAt ?? "") || 0;
      const tb = Date.parse(b.lastUpdatedAt ?? b.startedAt ?? "") || 0;
      return tb - ta;
    });
  } else if (mode === "nearest" && refLat != null && refLng != null) {
    list.sort(
      (a, b) =>
        haversineMeters(refLat, refLng, a.lat, a.lng) -
        haversineMeters(refLat, refLng, b.lat, b.lng)
    );
  }
  return list;
}

export function attachSafeSourceUrls(reports: LiveTrafficReport[]): LiveTrafficReport[] {
  return reports.map((r) => ({
    ...r,
    sourceUrl: sanitizeExternalUrl(r.sourceUrl),
  }));
}
