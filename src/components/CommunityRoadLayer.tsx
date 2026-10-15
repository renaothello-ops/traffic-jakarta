import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { CommunityRoad } from "../types";
import {
  ensureTrafficJakartaLayerOrder,
  safeGetSource,
  safeRemoveLayer,
  safeRemoveSource,
} from "../assets/lib/trafficLayer";
import { useMapStyleDataSync } from "../hooks/useMapStyleDataSync";

const SOURCE_ID = "community-roads";
const LAYER_ID = "community-roads-layer";
const OUTLINE_LAYER_ID = "community-roads-outline";

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  mapReady: boolean;
  roads: CommunityRoad[];
};

function buildRoadsKey(roads: CommunityRoad[]): string {
  return roads
    .map(
      (r) =>
        `${r.id}:${r.verified ? 1 : 0}:${r.coordinates
          .map((c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`)
          .join(";")}`
    )
    .join("|");
}

export default function CommunityRoadLayer({
  mapRef,
  mapReady,
  roads,
}: Props) {
  const roadsRef = useRef(roads);
  roadsRef.current = roads;

  const roadsKey = useMemo(() => buildRoadsKey(roads), [roads]);

  const sync = useCallback(
    (map: MaplibreMap) => {
      const currentRoads = roadsRef.current;
      const geojson = {
        type: "FeatureCollection" as const,
        features: currentRoads
          .filter((r) => r.coordinates.length >= 2)
          .map((r) => ({
            type: "Feature" as const,
            properties: {
              id: r.id,
              verified: r.verified,
              name: r.name ?? "Community road",
            },
            geometry: {
              type: "LineString" as const,
              coordinates: r.coordinates.map((c) => [c.lng, c.lat]),
            },
          })),
      };

      try {
        const existing = safeGetSource(map, SOURCE_ID);
        if (existing && "setData" in existing) {
          (existing as GeoJSONSource).setData(geojson);
          ensureTrafficJakartaLayerOrder(map);
          return;
        }

        safeRemoveLayer(map, LAYER_ID);
        safeRemoveLayer(map, OUTLINE_LAYER_ID);
        safeRemoveSource(map, SOURCE_ID);

        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: geojson,
        });

        map.addLayer({
          id: OUTLINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": "#6366f1",
            "line-width": 6,
            "line-opacity": 0.35,
            "line-dasharray": [2, 2],
          },
        });

        map.addLayer({
          id: LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": [
              "case",
              ["get", "verified"],
              "#4f46e5",
              "#a855f7",
            ],
            "line-width": 4,
            "line-opacity": 0.85,
            "line-dasharray": [1.5, 1.5],
          },
        });

        ensureTrafficJakartaLayerOrder(map);
      } catch (error) {
        console.error("[community-roads] map layer sync failed:", error);
      }
    },
    [roadsKey]
  );

  useMapStyleDataSync(mapRef, mapReady, sync, [roadsKey]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    return () => {
      safeRemoveLayer(map, LAYER_ID);
      safeRemoveLayer(map, OUTLINE_LAYER_ID);
      safeRemoveSource(map, SOURCE_ID);
    };
  }, [mapRef, mapReady]);

  return null;
}
