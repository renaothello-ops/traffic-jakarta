/**
 * TomTom numeric traffic adapter.
 * Current overlay uses raster tiles (/api/tomtom-flow.png) — no per-segment speeds.
 */

export type TomTomNumericTraffic = {
  currentSpeedKph: number | null;
  freeFlowSpeedKph: number | null;
  confidence: number | null;
  roadClosure: boolean | null;
};

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
