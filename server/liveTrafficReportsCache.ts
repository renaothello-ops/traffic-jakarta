import { INCIDENT_MISS_THRESHOLD } from "./liveTrafficLogic.js";
import {
  fetchTomTomIncidentDetails,
  type TomTomNormalizedIncident,
} from "./tomtomIncidentDetails.js";

/** Shared TomTom fetch interval — one upstream call per window for all users on this instance. */
export const LIVE_TRAFFIC_REFRESH_MS = 4 * 60 * 1000;

type TrackedIncident = TomTomNormalizedIncident & { missCount: number };

type CacheState = {
  fetchedAt: number;
  language: string;
  trafficModelId: string | null;
  byId: Map<string, TrackedIncident>;
  status: "ok" | "stale" | "unavailable";
  errorMessage: string | null;
  inflight: Promise<void> | null;
};

const cache: CacheState = {
  fetchedAt: 0,
  language: "en",
  trafficModelId: null,
  byId: new Map(),
  status: "unavailable",
  errorMessage: null,
  inflight: null,
};

function toLivePayload(incidents: TrackedIncident[]) {
  return incidents.map((i) => ({
    id: `tomtom:${i.id}`,
    sourceKind: "tomtom" as const,
    category: i.category,
    trustLevel: "provider" as const,
    severityScore: i.severityScore,
    magnitudeOfDelay: i.magnitudeOfDelay,
    delaySeconds: i.delaySeconds,
    lengthMeters: i.lengthMeters,
    roadName: i.roadName,
    placeName: i.placeName,
    lat: i.lat,
    lng: i.lng,
    summary: i.summary,
    detailKnown: i.detailKnown,
    startedAt: i.startedAt,
    lastUpdatedAt: i.lastUpdatedAt,
    sourceUrl: null,
    mergedSourceLabels: ["TomTom"],
  }));
}

function applyFetchResult(incidents: TomTomNormalizedIncident[]) {
  const seen = new Set<string>();
  for (const inc of incidents) {
    seen.add(inc.id);
    cache.byId.set(inc.id, { ...inc, missCount: 0 });
  }
  for (const [id, row] of cache.byId.entries()) {
    if (seen.has(id)) continue;
    const nextMiss = row.missCount + 1;
    if (nextMiss >= INCIDENT_MISS_THRESHOLD) {
      cache.byId.delete(id);
    } else {
      cache.byId.set(id, { ...row, missCount: nextMiss });
    }
  }
}

async function refreshCache(language: string): Promise<void> {
  const result = await fetchTomTomIncidentDetails(language);
  const now = Date.now();

  if (result.httpStatus === 200) {
    applyFetchResult(result.incidents);
    cache.status = "ok";
    cache.errorMessage = null;
    cache.fetchedAt = now;
    cache.trafficModelId = result.trafficModelId;
    cache.language = language;
    return;
  }

  if (cache.byId.size > 0 && now - cache.fetchedAt < LIVE_TRAFFIC_REFRESH_MS * 3) {
    cache.status = "stale";
    cache.errorMessage = result.errorMessage;
    return;
  }

  cache.status = "unavailable";
  cache.errorMessage = result.errorMessage;
  cache.fetchedAt = now;
}

export async function getLiveTrafficTomTomSnapshot(language: string) {
  const now = Date.now();
  const age = cache.fetchedAt ? now - cache.fetchedAt : null;
  const needsFetch =
    !cache.fetchedAt ||
    cache.language !== language ||
    age! >= LIVE_TRAFFIC_REFRESH_MS;

  if (needsFetch && !cache.inflight) {
    cache.inflight = refreshCache(language).finally(() => {
      cache.inflight = null;
    });
  }
  if (cache.inflight) {
    await cache.inflight;
  }

  const active = [...cache.byId.values()].filter(
    (r) => r.missCount < INCIDENT_MISS_THRESHOLD
  );

  return {
    status: cache.status,
    fetchedAt: cache.fetchedAt || null,
    cacheAgeMs: cache.fetchedAt ? now - cache.fetchedAt : null,
    nextRefreshMs: LIVE_TRAFFIC_REFRESH_MS,
    providerTrafficModelId: cache.trafficModelId,
    incidents: toLivePayload(active),
    missThreshold: INCIDENT_MISS_THRESHOLD,
    errorMessage: cache.errorMessage,
  };
}
