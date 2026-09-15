import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import {
  ensureTomTomTrafficLayer,
  isMapStyleMutable,
  repairTomTomTrafficLayer,
  refreshTomTomTrafficTiles,
  TOMTOM_SOURCE_ID,
  TRAFFIC_REFRESH_INTERVAL_MS,
} from "../assets/lib/trafficLayer";
import { trafficRefreshBucket } from "../assets/lib/trafficRefresh";

/**
 * Keeps TomTom traffic raster attached across pan/zoom/style reloads.
 * Tiles are fetched via /api/tomtom-flow.png (never exposes API key).
 * Refreshes tile URLs on a fixed interval to avoid stale raster cache.
 */
export function useTomTomTrafficLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapReady: boolean
) {
  const bucketRef = useRef(trafficRefreshBucket());

  useEffect(() => {
    if (!mapReady) return;

    const map = mapRef.current?.getMap();
    if (!map) {
      console.warn("[tomtom-traffic] map not available yet");
      return;
    }

    let active = true;
    let repairTimer: number | null = null;
    let refreshTimer: number | null = null;

    const scheduleRepair = () => {
      if (!active) return;
      if (repairTimer != null) window.clearTimeout(repairTimer);
      repairTimer = window.setTimeout(() => {
        if (!active) return;
        const liveMap = mapRef.current?.getMap();
        if (!liveMap || !isMapStyleMutable(liveMap)) return;
        repairTomTomTrafficLayer(liveMap);
      }, 80);
    };

    const refreshIfBucketChanged = () => {
      if (!active) return;
      const liveMap = mapRef.current?.getMap();
      if (!liveMap || !isMapStyleMutable(liveMap)) return;

      const nextBucket = trafficRefreshBucket();
      if (nextBucket === bucketRef.current) return;

      bucketRef.current = nextBucket;
      refreshTomTomTrafficTiles(liveMap, nextBucket);
    };

    const onLoad = () => {
      if (!active || !isMapStyleMutable(map)) return;
      ensureTomTomTrafficLayer(map);
    };

    const onError = (e: { sourceId?: string; error?: Error }) => {
      if (e.sourceId === TOMTOM_SOURCE_ID) {
        console.error("[tomtom-traffic] tile error:", e.error?.message ?? e);
      }
    };

    bucketRef.current = trafficRefreshBucket();
    if (isMapStyleMutable(map)) {
      ensureTomTomTrafficLayer(map);
    } else {
      map.once("load", onLoad);
    }

    refreshTimer = window.setInterval(
      refreshIfBucketChanged,
      TRAFFIC_REFRESH_INTERVAL_MS
    );

    map.on("styledata", scheduleRepair);
    map.on("error", onError);

    return () => {
      active = false;
      map.off("load", onLoad);
      map.off("styledata", scheduleRepair);
      map.off("error", onError);
      if (repairTimer != null) window.clearTimeout(repairTimer);
      if (refreshTimer != null) window.clearInterval(refreshTimer);
    };
  }, [mapRef, mapReady]);
}
