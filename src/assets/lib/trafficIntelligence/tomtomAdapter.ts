/**
 * TomTom numeric traffic adapter.
 * Raster overlay uses /api/tomtom-flow.png — no per-segment speeds.
 * Live segment data: server proxy /api/tomtom-flow-segment (not stored historically).
 */

import type { TomTomLiveNumeric } from "../../../intelligence/types";

export type TomTomNumericTraffic = {
  currentSpeedKph: number | null;
  freeFlowSpeedKph: number | null;
  confidence: number | null;
  roadClosure: boolean | null;
  observedAt?: number | null;
};

let inflight: Promise<TomTomNumericTraffic> | null = null;
let lastKey = "";
let lastResult: TomTomNumericTraffic | null = null;
let lastFetchAt = 0;
const CACHE_MS = 45_000;

export function fetchTomTomNumericTraffic(
  _lat: number,
  _lng: number
): TomTomNumericTraffic {
  return {
    currentSpeedKph: null,
    freeFlowSpeedKph: null,
    confidence: null,
    roadClosure: null,
  };
}

export async function fetchTomTomNumericTrafficAsync(
  lat: number,
  lng: number
): Promise<TomTomNumericTraffic> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const now = Date.now();
  if (
    lastResult &&
    lastKey === key &&
    now - lastFetchAt < CACHE_MS
  ) {
    return lastResult;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const url = `/api/tomtom-flow-segment?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
      const res = await fetch(url);
      if (!res.ok) {
        return fetchTomTomNumericTraffic(lat, lng);
      }
      const data = (await res.json()) as TomTomLiveNumeric;
      const result: TomTomNumericTraffic = {
        currentSpeedKph: data.currentSpeedKph ?? null,
        freeFlowSpeedKph: data.freeFlowSpeedKph ?? null,
        confidence: data.confidence ?? null,
        roadClosure: data.roadClosure ?? null,
        observedAt: data.observedAt ?? now,
      };
      lastKey = key;
      lastResult = result;
      lastFetchAt = now;
      return result;
    } catch {
      return fetchTomTomNumericTraffic(lat, lng);
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function computeCongestionRatio(
  trafficSpeed: number | null,
  freeFlowSpeed: number | null
): number | null {
  if (
    trafficSpeed == null ||
    freeFlowSpeed == null ||
    !Number.isFinite(trafficSpeed) ||
    !Number.isFinite(freeFlowSpeed) ||
    freeFlowSpeed <= 0
  ) {
    return null;
  }
  return trafficSpeed / freeFlowSpeed;
}
