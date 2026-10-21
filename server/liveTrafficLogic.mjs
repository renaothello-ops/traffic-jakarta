/** @generated from liveTrafficLogic.ts */
const JAKARTA_INCIDENT_BBOX = {
  minLon: 106.65,
  minLat: -6.45,
  maxLon: 107.05,
  maxLat: -5.95
};
const INCIDENT_MISS_THRESHOLD = 3;
function bboxParam(bbox) {
  return `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
}
function iconCategoryToLiveCategory(iconCategory) {
  const map = {
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
    14: "breakdown"
  };
  return map[iconCategory] ?? "unknown";
}
function postTypeToLiveCategory(type) {
  const map = {
    accident: "accident",
    road_closed: "road_closed",
    heavy_traffic: "congestion",
    flooded: "flood",
    construction: "construction",
    hazard: "hazard",
    car_passable: "congestion",
    motorcycle_only: "congestion",
    other: "other"
  };
  return map[type] ?? "other";
}
function computeTomTomSeverityScore(props) {
  const mag = props.magnitudeOfDelay ?? 0;
  const delay = props.delay ?? 0;
  const length = props.length ?? 0;
  let score = mag * 18;
  if (delay > 0) score += Math.min(35, Math.round(delay / 90));
  if (length > 0) score += Math.min(25, Math.round(length / 400));
  return Math.min(100, Math.max(0, score));
}
function communitySeverityScore(post) {
  const confirms = post.confirmCount ?? 0;
  const denies = post.denyCount ?? 0;
  const net = Math.max(0, confirms - denies);
  return Math.min(72, 28 + net * 6);
}
function centroidFromGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    const pts = geometry.coordinates.filter((c) => c?.length >= 2);
    if (!pts.length) return null;
    const mid = pts[Math.floor(pts.length / 2)];
    return { lat: mid[1], lng: mid[0] };
  }
  return null;
}
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function dedupeLiveReports(reports, options = {}) {
  const maxM = options.maxDistanceM ?? 450;
  const out = [];
  for (const r of reports) {
    let merged = false;
    for (const existing of out) {
      if (existing.category !== r.category) continue;
      const dist = haversineMeters(existing.lat, existing.lng, r.lat, r.lng);
      if (dist > maxM) continue;
      existing.mergedSourceLabels = [
        .../* @__PURE__ */ new Set([...existing.mergedSourceLabels, ...r.mergedSourceLabels])
      ];
      if (r.severityScore > existing.severityScore) {
        existing.severityScore = r.severityScore;
        existing.summary = r.summary ?? existing.summary;
        existing.delaySeconds = r.delaySeconds ?? existing.delaySeconds;
        existing.lengthMeters = r.lengthMeters ?? existing.lengthMeters;
      }
      if (r.lastUpdatedAt && (!existing.lastUpdatedAt || r.lastUpdatedAt > existing.lastUpdatedAt)) {
        existing.lastUpdatedAt = r.lastUpdatedAt;
      }
      merged = true;
      break;
    }
    if (!merged) out.push({ ...r, mergedSourceLabels: [...r.mergedSourceLabels] });
  }
  return out;
}
function sortLiveReports(reports, mode, refLat, refLng) {
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
      (a, b) => haversineMeters(refLat, refLng, a.lat, a.lng) - haversineMeters(refLat, refLng, b.lat, b.lng)
    );
  }
  return list;
}
function updateIncidentPresenceTracker(tracker, seenIds, now = Date.now()) {
  const next = { ...tracker, lastFetchAt: now };
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
function filterActiveTrackedIds(tracker, allIds) {
  const active = /* @__PURE__ */ new Set();
  for (const id of allIds) {
    const row = tracker[id];
    if (row && typeof row === "object" && row.missCount != null && (row.missCount ?? 0) < INCIDENT_MISS_THRESHOLD) {
      active.add(id);
    }
  }
  return active;
}
export {
  INCIDENT_MISS_THRESHOLD,
  JAKARTA_INCIDENT_BBOX,
  bboxParam,
  centroidFromGeometry,
  communitySeverityScore,
  computeTomTomSeverityScore,
  dedupeLiveReports,
  filterActiveTrackedIds,
  haversineMeters,
  iconCategoryToLiveCategory,
  postTypeToLiveCategory,
  sortLiveReports,
  updateIncidentPresenceTracker
};
