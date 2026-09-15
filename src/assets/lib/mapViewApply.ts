import type { Map as MaplibreMap } from "maplibre-gl";
import { isMapStyleMutable } from "./trafficLayer";
import { MAP_VIEW_PITCH, type MapViewMode } from "./mapViewMode";

export function setBuildingExtrusionVisible(
  map: MaplibreMap,
  visible: boolean
): void {
  if (!isMapStyleMutable(map)) return;

  try {
    const layers = map.getStyle().layers ?? [];
    for (const layer of layers) {
      if (layer.type !== "fill-extrusion") continue;
      map.setLayoutProperty(
        layer.id,
        "visibility",
        visible ? "visible" : "none"
      );
    }
  } catch {
    // Style may be reloading.
  }
}

type ApplyMapViewModeOptions = {
  /** When false, browsing mode resets bearing to north-up in 2D. */
  isNavigating?: boolean;
  bearing?: number | null;
  duration?: number;
};

export function applyMapViewMode(
  map: MaplibreMap,
  mode: MapViewMode,
  options: ApplyMapViewModeOptions = {}
): void {
  if (!isMapStyleMutable(map)) return;

  const pitch = MAP_VIEW_PITCH[mode];
  const duration = options.duration ?? 600;
  const isNavigating = options.isNavigating ?? false;

  setBuildingExtrusionVisible(map, mode === "3d");

  const bearing =
    mode === "2d" && !isNavigating
      ? 0
      : typeof options.bearing === "number"
        ? options.bearing
        : map.getBearing();

  map.easeTo({
    pitch,
    bearing,
    duration,
  });
}
