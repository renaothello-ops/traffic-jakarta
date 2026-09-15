import type { Map as MaplibreMap } from "maplibre-gl";
import {
  ensureTrafficJakartaLayerOrder,
  isMapStyleMutable,
  safeGetLayer,
  safeGetSource,
  safeRemoveLayer,
  safeRemoveSource,
  TOMTOM_LAYER_ID,
  TOMTOM_SOURCE_ID,
} from "./trafficLayer";

/** How often to request fresh TomTom raster tiles (aligned with proxy cache TTL). */
export const TRAFFIC_REFRESH_INTERVAL_MS = 45_000;

const MANUAL_REFRESH_MIN_MS = 30_000;

export type TrafficRefreshDiagnostics = {
  trafficLastRequestedAt: number | null;
  trafficLastRenderedAt: number | null;
  lastRefreshBucket: number | null;
};

export const trafficRefreshDiagnostics: TrafficRefreshDiagnostics = {
  trafficLastRequestedAt: null,
  trafficLastRenderedAt: null,
  lastRefreshBucket: null,
};

let lastManualRefreshAt = 0;

export function trafficRefreshBucket(now = Date.now()): number {
  return Math.floor(now / TRAFFIC_REFRESH_INTERVAL_MS);
}

export function buildTomTomTileUrl(
  refreshBucket: number,
  forceNonce?: number
): string {
  const base = `/api/tomtom-flow.png?mode=relative&z={z}&x={x}&y={y}&v=${refreshBucket}`;
  if (forceNonce == null) return base;
  return `${base}&r=${forceNonce}`;
}

export function recordTrafficRequested(at = Date.now()): void {
  trafficRefreshDiagnostics.trafficLastRequestedAt = at;
}

export function recordTrafficRendered(
  bucket: number,
  at = Date.now()
): void {
  trafficRefreshDiagnostics.trafficLastRenderedAt = at;
  trafficRefreshDiagnostics.lastRefreshBucket = bucket;
}

const TOMTOM_LAYER_PAINT = {
  "raster-opacity": 0.85,
  "raster-contrast": 0.2,
  "raster-saturation": 1,
} as const;

/** Recreate the TomTom raster source so MapLibre requests fresh tiles. */
export function refreshTomTomTrafficTiles(
  map: MaplibreMap,
  refreshBucket: number,
  options?: { forceNonce?: number }
): void {
  if (!isMapStyleMutable(map)) return;

  const tileUrl = buildTomTomTileUrl(refreshBucket, options?.forceNonce);
  recordTrafficRequested();

  try {
    safeRemoveLayer(map, TOMTOM_LAYER_ID);
    safeRemoveSource(map, TOMTOM_SOURCE_ID);

    map.addSource(TOMTOM_SOURCE_ID, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
    });

    map.addLayer({
      id: TOMTOM_LAYER_ID,
      type: "raster",
      source: TOMTOM_SOURCE_ID,
      paint: TOMTOM_LAYER_PAINT,
    });

    ensureTrafficJakartaLayerOrder(map);
    recordTrafficRendered(refreshBucket);
  } catch (error) {
    console.error("[tomtom-traffic] refresh failed:", error);
  }
}

/** Attach TomTom traffic if missing; uses the current refresh bucket in tile URLs. */
export function ensureTomTomTrafficLayerWithBucket(
  map: MaplibreMap,
  refreshBucket = trafficRefreshBucket()
): void {
  if (!isMapStyleMutable(map)) return;

  const tileUrl = buildTomTomTileUrl(refreshBucket);

  try {
    if (!safeGetSource(map, TOMTOM_SOURCE_ID)) {
      recordTrafficRequested();
      map.addSource(TOMTOM_SOURCE_ID, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
      });
    }

    if (!safeGetLayer(map, TOMTOM_LAYER_ID)) {
      map.addLayer({
        id: TOMTOM_LAYER_ID,
        type: "raster",
        source: TOMTOM_SOURCE_ID,
        paint: TOMTOM_LAYER_PAINT,
      });
      recordTrafficRendered(refreshBucket);
    }

    ensureTrafficJakartaLayerOrder(map);
  } catch (error) {
    console.error("[tomtom-traffic] ensure layer failed:", error);
  }
}

/** Throttled manual refresh for explicit recenter/current-location actions. */
export function requestManualTomTomTrafficRefresh(map: MaplibreMap): void {
  const now = Date.now();
  if (now - lastManualRefreshAt < MANUAL_REFRESH_MIN_MS) return;
  lastManualRefreshAt = now;
  refreshTomTomTrafficTiles(map, trafficRefreshBucket(), { forceNonce: now });
}

/** Attach TomTom traffic raster layer (idempotent). */
export function ensureTomTomTrafficLayer(map: MaplibreMap): void {
  ensureTomTomTrafficLayerWithBucket(map, trafficRefreshBucket());
}

/** Repair after style reload or when layer was dropped but source remains. */
export function repairTomTomTrafficLayer(map: MaplibreMap): void {
  if (!isMapStyleMutable(map)) return;

  const hasSource = Boolean(safeGetSource(map, TOMTOM_SOURCE_ID));
  const hasLayer = Boolean(safeGetLayer(map, TOMTOM_LAYER_ID));

  if (!hasSource) {
    ensureTomTomTrafficLayer(map);
    return;
  }

  if (!hasLayer) {
    ensureTomTomTrafficLayerWithBucket(map, trafficRefreshBucket());
    return;
  }

  ensureTrafficJakartaLayerOrder(map);
}
