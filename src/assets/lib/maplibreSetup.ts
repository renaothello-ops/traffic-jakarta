/**
 * MapLibre v6 worker bootstrap for Vite.
 * Must run once before any Map is constructed.
 */
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(maplibreWorkerUrl);

/**
 * MapLibre v6 moved transform onto the internal camera; react-map-gl 8.x still
 * reads map.transform during easeTo/flyTo/fitBounds move events.
 */
type MapWithCamera = maplibregl.Map & {
  _camera?: { transform: unknown };
};

if (!Object.getOwnPropertyDescriptor(maplibregl.Map.prototype, "transform")) {
  Object.defineProperty(maplibregl.Map.prototype, "transform", {
    get(this: MapWithCamera) {
      return this._camera?.transform;
    },
    configurable: true,
  });
}

export { maplibregl };
