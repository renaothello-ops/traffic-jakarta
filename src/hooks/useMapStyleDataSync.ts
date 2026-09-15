import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { Map as MaplibreMap } from "maplibre-gl";
import { isMapStyleMutable } from "../assets/lib/trafficLayer";

/**
 * Runs sync when the map is ready, when `deps` change, and after each basemap style reload.
 */
export function useMapStyleDataSync(
  mapRef: React.RefObject<MapRef | null>,
  mapReady: boolean,
  sync: (map: MaplibreMap) => void,
  deps: unknown[] = []
): void {
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let active = true;

    const runSync = () => {
      if (!active || !isMapStyleMutable(map)) return;
      syncRef.current(map);
    };

    const onLoad = () => {
      if (active) runSync();
    };

    const onStyleData = () => {
      if (active && map.isStyleLoaded()) runSync();
    };

    if (isMapStyleMutable(map)) runSync();
    else map.once("load", onLoad);

    map.on("styledata", onStyleData);

    return () => {
      active = false;
      map.off("load", onLoad);
      map.off("styledata", onStyleData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are caller-controlled triggers
  }, [mapRef, mapReady, ...deps]);
}
