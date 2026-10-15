export type MapViewMode = "2d" | "3d";

/** Versioned key — ignores any legacy unversioned preference. */
export const MAP_VIEW_MODE_STORAGE_KEY = "tj_map_view_mode_v1";

export const MAP_VIEW_PITCH: Record<MapViewMode, number> = {
  "2d": 0,
  "3d": 52,
};

export function loadMapViewMode(): MapViewMode {
  if (typeof window === "undefined") return "2d";
  const raw = localStorage.getItem(MAP_VIEW_MODE_STORAGE_KEY);
  if (raw === "2d" || raw === "3d") return raw;
  return "2d";
}

export function saveMapViewMode(mode: MapViewMode): void {
  localStorage.setItem(MAP_VIEW_MODE_STORAGE_KEY, mode);
}
