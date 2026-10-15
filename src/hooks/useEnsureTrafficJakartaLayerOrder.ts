import { useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import {
  ensureTrafficJakartaLayerOrder,
  isMapStyleMutable,
} from "../assets/lib/trafficLayer";

/**
 * Keeps TomTom traffic below navigation routes across style reloads,
 * tile repairs, reroutes, and navigation progress updates.
 */
export function useEnsureTrafficJakartaLayerOrder(
  mapRef: React.RefObject<MapRef | null>,
  mapReady: boolean,
  triggers: unknown[] = []
): void {
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let active = true;
    let raf = 0;

    const run = () => {
      if (!active || !isMapStyleMutable(map)) return;
      ensureTrafficJakartaLayerOrder(map);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(run);
    };

    schedule();
    map.on("styledata", schedule);
    map.on("load", schedule);
    map.on("idle", schedule);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      map.off("styledata", schedule);
      map.off("load", schedule);
      map.off("idle", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-controlled triggers
  }, [mapRef, mapReady, ...triggers]);
}
