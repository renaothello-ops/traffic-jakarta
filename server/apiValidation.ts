export const MAX_PLACES_QUERY_LENGTH = 200;
export const MAX_PLACES_TEXT_QUERY_LENGTH = 200;
export const MAX_PLACES_RADIUS_M = 100_000;
export const MIN_PLACES_RADIUS_M = 100;

const PLACES_ACTIONS = new Set(["autocomplete", "searchText", "details"]);
const TILE_MODES = new Set(["relative", "absolute"]);
const MAX_TILE_ZOOM = 22;

export function parseFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseLatitude(value: unknown): number | null {
  const n = parseFiniteNumber(value);
  if (n == null || n < -90 || n > 90) return null;
  return n;
}

export function parseLongitude(value: unknown): number | null {
  const n = parseFiniteNumber(value);
  if (n == null || n < -180 || n > 180) return null;
  return n;
}

export function parsePlacesAction(value: unknown): string | null {
  const action = String(value ?? "").trim();
  return PLACES_ACTIONS.has(action) ? action : null;
}

export function parsePlacesQuery(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

export function parsePlacesRadius(value: unknown): number | null {
  const n = parseFiniteNumber(value);
  if (n == null || n < MIN_PLACES_RADIUS_M || n > MAX_PLACES_RADIUS_M) return null;
  return n;
}

/** Google Places API (New) languageCode — BCP-47 subset used by the app. */
export function parsePlacesLanguageCode(value: unknown): string {
  const raw = String(value ?? "en").trim();
  const allowed = new Set([
    "id", "en", "ja", "ko", "ms", "th", "vi", "fil", "hi", "ar", "es", "fr",
    "de", "pt", "it", "ru", "tr", "nl", "zh-CN", "zh-TW", "zh-Hans", "zh-Hant",
  ]);
  if (allowed.has(raw)) {
    if (raw === "zh-Hans") return "zh-CN";
    if (raw === "zh-Hant") return "zh-TW";
    return raw;
  }
  const base = raw.split("-")[0];
  if (base === "zh") return raw.toLowerCase().includes("hant") ? "zh-TW" : "zh-CN";
  return allowed.has(base) ? base : "en";
}

export function parsePlaceId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  if (!id || id.length > 512) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return id;
}

export function parseMaxResultCount(value: unknown): number {
  const n = parseFiniteNumber(value);
  if (n == null) return 10;
  return Math.min(20, Math.max(1, Math.round(n)));
}

export function parseTileMode(value: unknown): string | null {
  const mode = String(value ?? "").trim();
  return TILE_MODES.has(mode) ? mode : null;
}

export function parseTileZoom(value: unknown): number | null {
  const z = parseFiniteNumber(value);
  if (z == null || !Number.isInteger(z) || z < 0 || z > MAX_TILE_ZOOM) return null;
  return z;
}

export function parseTileIndex(value: unknown, z: number): number | null {
  const n = parseFiniteNumber(value);
  if (n == null || !Number.isInteger(n) || n < 0) return null;
  const maxIndex = Math.pow(2, z) - 1;
  if (n > maxIndex) return null;
  return n;
}

export function parseRouteCoordinatePair(
  originLat: unknown,
  originLng: unknown,
  destLat: unknown,
  destLng: unknown
):
  | { originLat: number; originLng: number; destLat: number; destLng: number }
  | null {
  const oLat = parseLatitude(originLat);
  const oLng = parseLongitude(originLng);
  const dLat = parseLatitude(destLat);
  const dLng = parseLongitude(destLng);
  if (oLat == null || oLng == null || dLat == null || dLng == null) return null;
  return { originLat: oLat, originLng: oLng, destLat: dLat, destLng: dLng };
}
