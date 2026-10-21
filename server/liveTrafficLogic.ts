/** Shared live traffic helpers (server + node tests). */

export const JAKARTA_INCIDENT_BBOX = {
  minLon: 106.65,
  minLat: -6.45,
  maxLon: 107.05,
  maxLat: -5.95,
};

export const INCIDENT_MISS_THRESHOLD = 3;

export type LiveCategory =
  | "unknown"
  | "accident"
  | "weather"
  | "hazard"
  | "congestion"
  | "lane_closed"
  | "road_closed"
  | "construction"
  | "flood"
  | "breakdown"
  | "other";

export function bboxParam(bbox: typeof JAKARTA_INCIDENT_BBOX): string {
  return `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
}

export function iconCategoryToLiveCategory(iconCategory: number): LiveCategory {
  const map: Record<number, LiveCategory> = {
    0: "unknown",
    1: "accident",
    2: "weather",
    3: "hazard",
    4: "weather",
    5: "weather",
    6: "congestion",
    7: "lane_closed",
    8: "road_closed",
    9: "construction",
    10: "weather",
    11: "flood",
    14: "breakdown",
  };
  return map[iconCategory] ?? "unknown";
}

export function postTypeToLiveCategory(type: string): LiveCategory {
  const map: Record<string, LiveCategory> = {
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

export function computeTomTomSeverityScore(props: {
  magnitudeOfDelay?: number | null;
  delay?: number | null;
  length?: number | null;
}): number {
  const mag = props.magnitudeOfDelay ?? 0;
  const delay = props.delay ?? 0;
  const length = props.length ?? 0;
  let score = mag * 18;
  if (delay > 0) score += Math.min(35, Math.round(delay / 90));
  if (length > 0) score += Math.min(25, Math.round(length / 400));
  return Math.min(100, Math.max(0, score));
}

export function communitySeverityScore(post: {
  confirmCount?: number;
  denyCount?: number;
}): number {
  const confirms = post.confirmCount ?? 0;
  const denies = post.denyCount ?? 0;
  const net = Math.max(0, confirms - denies);
  return Math.min(72, 28 + net * 6);
}

export function centroidFromGeometry(
  geometry: { type?: string; coordinates?: unknown } | null | undefined
): { lat: number; lng: number } | null {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates as number[];
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    const pts = (geometry.coordinates as number[][]).filter((c) => c?.length >= 2);
    if (!pts.length) return null;
    const mid = pts[Math.floor(pts.length / 2)];
    return { lat: mid[1], lng: mid[0] };
  }
  return null;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type DedupeReport = {
  id: string;
  category: string;
  lat: number;
  lng: number;
  severityScore: number;
  summary?: string | null;
  delaySeconds?: number | null;
  lengthMeters?: number | null;
  lastUpdatedAt?: string | null;
  startedAt?: string | null;
  mergedSourceLabels: string[];
};

export function dedupeLiveReports(
  reports: DedupeReport[],
  options: { maxDistanceM?: number } = {}
): DedupeReport[] {
  const maxM = options.maxDistanceM ?? 450;
  const out: DedupeReport[] = [];
  for (const r of reports) {
    let merged = false;
    for (const existing of out) {
      if (existing.category !== r.category) continue;
      const dist = haversineMeters(existing.lat, existing.lng, r.lat, r.lng);
      if (dist > maxM) continue;
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
    if (!merged) out.push({ ...r, mergedSourceLabels: [...r.mergedSourceLabels] });
  }
  return out;
}

export function sortLiveReports(
  reports: DedupeReport[],
  mode: string,
  refLat: number | null,
  refLng: number | null
): DedupeReport[] {
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

type PresenceRow = { lastSeenAt?: number; missCount?: number };

export function updateIncidentPresenceTracker(
  tracker: Record<string, PresenceRow | number>,
  seenIds: Set<string>,
  now = Date.now()
): Record<string, PresenceRow | number> {
  const next: Record<string, PresenceRow | number> = { ...tracker, lastFetchAt: now };
  for (const id of seenIds) {
    next[id] = { lastSeenAt: now, missCount: 0 };
  }
  for (const id of Object.keys(next)) {
    if (id === "lastFetchAt") continue;
    if (seenIds.has(id)) continue;
    const row = next[id];
    if (typeof row !== "object" || row == null) continue;
    row.missCount = (row.missCount ?? 0) + 1;
    if (row.missCount >= INCIDENT_MISS_THRESHOLD) {
      delete next[id];
    } else {
      next[id] = row;
    }
  }
  return next;
}

export function filterActiveTrackedIds(
  tracker: Record<string, { missCount?: number } | unknown>,
  allIds: string[]
): Set<string> {
  const active = new Set<string>();
  for (const id of allIds) {
    const row = tracker[id];
    if (
      row &&
      typeof row === "object" &&
      (row as { missCount?: number }).missCount != null &&
      ((row as { missCount?: number }).missCount ?? 0) < INCIDENT_MISS_THRESHOLD
    ) {
      active.add(id);
    }
  }
  return active;
}
