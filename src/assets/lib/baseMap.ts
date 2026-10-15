/** Default POI-rich OSM vector style (no API key). Override via env for other providers. */
export const DEFAULT_BASE_MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

/** CARTO Positron — previous sparse basemap (reference only). */
export const LEGACY_CARTO_POSITRON_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

/**
 * MapLibre style URL for the basemap.
 * Set `VITE_BASE_MAP_STYLE_URL` to use MapTiler, Protomaps, etc. (provider-specific key in URL).
 */
export function getBaseMapStyleUrl(): string {
  const configured = import.meta.env.VITE_BASE_MAP_STYLE_URL?.trim();
  return configured || DEFAULT_BASE_MAP_STYLE_URL;
}
