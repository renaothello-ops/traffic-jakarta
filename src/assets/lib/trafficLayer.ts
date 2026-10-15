import type { Map as MaplibreMap } from "maplibre-gl";

export const TOMTOM_SOURCE_ID = "tomtom-traffic";
export const TOMTOM_LAYER_ID = "tomtom-traffic-layer";

/** Navigation route line layers (bottom → top within route group). */
export const NAV_ROUTE_DONE_CASING_LAYER = "nav-route-done-casing-layer";
export const NAV_ROUTE_DONE_LAYER = "nav-route-done-layer";
export const NAV_ROUTE_ALT_CASING_LAYER = "nav-route-alt-casing-layer";
export const NAV_ROUTE_ALT_LAYER = "nav-route-alt-layer";
export const NAV_ROUTE_MAIN_CASING_LAYER = "nav-route-main-casing-layer";
export const NAV_ROUTE_MAIN_LAYER = "nav-route-main-layer";

const COMMUNITY_ROAD_LAYER_ORDER = [
  "community-roads-outline",
  "community-roads-layer",
] as const;

const NAV_ROUTE_LAYER_ORDER = [
  NAV_ROUTE_DONE_CASING_LAYER,
  NAV_ROUTE_DONE_LAYER,
  NAV_ROUTE_ALT_CASING_LAYER,
  NAV_ROUTE_ALT_LAYER,
  NAV_ROUTE_MAIN_CASING_LAYER,
  NAV_ROUTE_MAIN_LAYER,
] as const;

/** Draft community road preview while drawing. */
export const DRAFT_ROAD_LAYER_ID = "draft-road-layer";

/**
 * Custom overlay stack (bottom → top).
 * Each layer is moved to the top in sequence so the final order matches this list.
 */
export const TRAFFIC_JAKARTA_LAYER_STACK = [
  TOMTOM_LAYER_ID,
  ...COMMUNITY_ROAD_LAYER_ORDER,
  DRAFT_ROAD_LAYER_ID,
  ...NAV_ROUTE_LAYER_ORDER,
] as const;

export {
  ensureTomTomTrafficLayer,
  repairTomTomTrafficLayer,
  refreshTomTomTrafficTiles,
  trafficRefreshBucket,
  TRAFFIC_REFRESH_INTERVAL_MS,
} from "./trafficRefresh";

/** Style object is present — safe to call getLayer/getSource/add/remove. */
export function isMapStyleMutable(map: MaplibreMap): boolean {
  try {
    if (!map.isStyleLoaded()) return false;
    map.getStyle();
    return true;
  } catch {
    return false;
  }
}

export function safeGetLayer(map: MaplibreMap, id: string) {
  if (!isMapStyleMutable(map)) return undefined;
  try {
    return map.getLayer(id);
  } catch {
    return undefined;
  }
}

export function safeGetSource(map: MaplibreMap, id: string) {
  if (!isMapStyleMutable(map)) return undefined;
  try {
    return map.getSource(id);
  } catch {
    return undefined;
  }
}

export function safeRemoveLayer(map: MaplibreMap, id: string): void {
  if (!safeGetLayer(map, id)) return;
  try {
    map.removeLayer(id);
  } catch {
    // Style may have been torn down mid-reload.
  }
}

export function safeRemoveSource(map: MaplibreMap, id: string): void {
  if (!isMapStyleMutable(map)) return;
  try {
    if (map.getSource(id)) map.removeSource(id);
  } catch {
    // Style may have been torn down mid-reload.
  }
}

/**
 * Enforces Traffic Jakarta overlay z-order (bottom → top):
 * TomTom traffic → community roads → draft road → navigation route → HTML markers
 *
 * Moves each present layer to the top in stack order so the active route always
 * renders above TomTom traffic, even after style reloads or raster tile repairs.
 */
export function ensureTrafficJakartaLayerOrder(map: MaplibreMap): void {
  if (!isMapStyleMutable(map)) return;

  for (const id of TRAFFIC_JAKARTA_LAYER_STACK) {
    if (!safeGetLayer(map, id)) continue;
    try {
      map.moveLayer(id);
    } catch {
      // Layer may be mid-reload.
    }
  }
}

/** @deprecated Use ensureTrafficJakartaLayerOrder */
export function reconcileOverlayLayerOrder(map: MaplibreMap): void {
  ensureTrafficJakartaLayerOrder(map);
}

/** @deprecated Use ensureTrafficJakartaLayerOrder */
export function bringTomTomTrafficToFront(map: MaplibreMap): void {
  ensureTrafficJakartaLayerOrder(map);
}

