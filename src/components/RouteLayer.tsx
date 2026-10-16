import { useCallback, useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MaplibreMap,
} from "maplibre-gl";
import type { RoutePlan } from "../types";
import {
  NAV_ROUTE_ALT_CASING_LAYER,
  NAV_ROUTE_ALT_LAYER,
  NAV_ROUTE_DONE_CASING_LAYER,
  NAV_ROUTE_DONE_LAYER,
  NAV_ROUTE_MAIN_CASING_LAYER,
  NAV_ROUTE_MAIN_LAYER,
  ensureTrafficJakartaLayerOrder,
  safeGetSource,
  safeRemoveLayer,
  safeRemoveSource,
} from "../assets/lib/trafficLayer";
import { useMapStyleDataSync } from "../hooks/useMapStyleDataSync";

const MAIN_SOURCE = "nav-route-main";
const DONE_SOURCE = "nav-route-done";
const ALT_SOURCE = "nav-route-alt";

const ROUTE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  5,
  15,
  7,
  17,
  8,
  19,
  9,
];

const ROUTE_CASING_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  9,
  15,
  11,
  17,
  12,
  19,
  13,
];

const DONE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  4,
  15,
  5,
  17,
  6,
  19,
  7,
];

const DONE_CASING_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  7,
  15,
  8,
  17,
  9,
  19,
  10,
];

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  mapReady: boolean;
  routePlan: RoutePlan | null;
  completedCoordinates?: Array<[number, number]>;
  remainingCoordinates?: Array<[number, number]>;
  navigationMode?: boolean;
};

function upsertLineLayer(
  map: MaplibreMap,
  sourceId: string,
  casingLayerId: string,
  lineLayerId: string,
  coordinates: Array<[number, number]>,
  paint: {
    casingColor: string;
    casingOpacity: number;
    lineColor: string;
    lineOpacity: number;
    lineWidth: ExpressionSpecification | number;
    casingWidth: ExpressionSpecification | number;
    dasharray?: number[];
  }
): void {
  const feature = {
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates },
    properties: {},
  };

  const existing = safeGetSource(map, sourceId);
  if (existing && "setData" in existing) {
    (existing as GeoJSONSource).setData(feature);
    ensureTrafficJakartaLayerOrder(map);
  } else {
    safeRemoveLayer(map, lineLayerId);
    safeRemoveLayer(map, casingLayerId);
    safeRemoveSource(map, sourceId);
    map.addSource(sourceId, { type: "geojson", data: feature });
    map.addLayer({
      id: casingLayerId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": paint.casingColor,
        "line-width": paint.casingWidth,
        "line-opacity": paint.casingOpacity,
      },
    });
    map.addLayer({
      id: lineLayerId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": paint.lineColor,
        "line-width": paint.lineWidth,
        "line-opacity": paint.lineOpacity,
        ...(paint.dasharray ? { "line-dasharray": paint.dasharray } : {}),
      },
    });
  }
}

function removeRoutePair(
  map: MaplibreMap,
  sourceId: string,
  casingLayerId: string,
  lineLayerId: string
): void {
  safeRemoveLayer(map, lineLayerId);
  safeRemoveLayer(map, casingLayerId);
  safeRemoveSource(map, sourceId);
}

export default function RouteLayer({
  mapRef,
  mapReady,
  routePlan,
  completedCoordinates,
  remainingCoordinates,
  navigationMode = false,
}: Props) {
  const sync = useCallback(
    (map: MaplibreMap) => {
      try {
        removeRoutePair(map, MAIN_SOURCE, NAV_ROUTE_MAIN_CASING_LAYER, NAV_ROUTE_MAIN_LAYER);
        removeRoutePair(map, DONE_SOURCE, NAV_ROUTE_DONE_CASING_LAYER, NAV_ROUTE_DONE_LAYER);
        removeRoutePair(map, ALT_SOURCE, NAV_ROUTE_ALT_CASING_LAYER, NAV_ROUTE_ALT_LAYER);

        if (!routePlan || routePlan.routes.length === 0) {
          ensureTrafficJakartaLayerOrder(map);
          return;
        }

        const selected = routePlan.routes[routePlan.selectedIndex];
        if (!selected || selected.coordinates.length < 2) {
          ensureTrafficJakartaLayerOrder(map);
          return;
        }

        const mainCoords =
          navigationMode && remainingCoordinates && remainingCoordinates.length >= 2
            ? remainingCoordinates
            : selected.coordinates;

        const doneCoords =
          navigationMode && completedCoordinates && completedCoordinates.length >= 2
            ? completedCoordinates
            : null;

        if (doneCoords) {
          upsertLineLayer(
            map,
            DONE_SOURCE,
            NAV_ROUTE_DONE_CASING_LAYER,
            NAV_ROUTE_DONE_LAYER,
            doneCoords,
            {
              casingColor: "#e2e8f0",
              casingOpacity: 0.75,
              lineColor: "#64748b",
              lineOpacity: 0.5,
              lineWidth: DONE_WIDTH,
              casingWidth: DONE_CASING_WIDTH,
            }
          );
        }

        upsertLineLayer(
          map,
          MAIN_SOURCE,
          NAV_ROUTE_MAIN_CASING_LAYER,
          NAV_ROUTE_MAIN_LAYER,
          mainCoords,
          {
            casingColor: "#ffffff",
            casingOpacity: 0.98,
            lineColor: "#1d4ed8",
            lineOpacity: 1,
            lineWidth: ROUTE_WIDTH,
            casingWidth: ROUTE_CASING_WIDTH,
          }
        );

        if (!navigationMode) {
          const alt = routePlan.routes.find((_, i) => i !== routePlan.selectedIndex);
          if (alt && alt.coordinates.length >= 2) {
            upsertLineLayer(
              map,
              ALT_SOURCE,
              NAV_ROUTE_ALT_CASING_LAYER,
              NAV_ROUTE_ALT_LAYER,
              alt.coordinates,
              {
                casingColor: "#f1f5f9",
                casingOpacity: 0.85,
                lineColor: "#94a3b8",
                lineOpacity: 0.65,
                lineWidth: [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  12,
                  3,
                  15,
                  4,
                  17,
                  5,
                  19,
                  6,
                ],
                casingWidth: [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  12,
                  6,
                  15,
                  7,
                  17,
                  8,
                  19,
                  9,
                ],
                dasharray: [2, 2],
              }
            );
          }
        }

        ensureTrafficJakartaLayerOrder(map);
      } catch (error) {
        console.error("[route-layer] map layer sync failed:", error);
      }
    },
    [routePlan, navigationMode, completedCoordinates, remainingCoordinates]
  );

  const routeKey = routePlan
    ? `${routePlan.selectedIndex}:${routePlan.routes[routePlan.selectedIndex]?.coordinates.length ?? 0}`
    : "none";

  const progressKey = navigationMode
    ? `${completedCoordinates?.length ?? 0}:${remainingCoordinates?.length ?? 0}:${remainingCoordinates?.[0]?.join(",") ?? ""}`
    : "preview";

  useMapStyleDataSync(mapRef, mapReady, sync, [routeKey, progressKey, navigationMode]);

  useEffect(() => {
    if (!mapReady || !navigationMode) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    sync(map);
  }, [mapReady, mapRef, navigationMode, sync, progressKey]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    return () => {
      removeRoutePair(map, MAIN_SOURCE, NAV_ROUTE_MAIN_CASING_LAYER, NAV_ROUTE_MAIN_LAYER);
      removeRoutePair(map, DONE_SOURCE, NAV_ROUTE_DONE_CASING_LAYER, NAV_ROUTE_DONE_LAYER);
      removeRoutePair(map, ALT_SOURCE, NAV_ROUTE_ALT_CASING_LAYER, NAV_ROUTE_ALT_LAYER);
    };
  }, [mapRef, mapReady]);

  return null;
}
