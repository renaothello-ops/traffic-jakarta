/** Base off-route distance before GPS accuracy multiplier. */
export const OFF_ROUTE_BASE_THRESHOLD_M = 40;

/** Multiplier applied to reported GPS accuracy for off-route threshold. */
export const OFF_ROUTE_ACCURACY_MULTIPLIER = 2.5;

/** Consecutive off-route samples required before reroute. */
export const OFF_ROUTE_CONSECUTIVE_SAMPLES = 2;

/** Minimum time between automatic reroutes, ms. */
export const REROUTE_COOLDOWN_MS = 15_000;

/** Arrival radius from destination, meters (before accuracy padding). */
export const ARRIVAL_BASE_RADIUS_M = 35;

export function effectiveOffRouteThresholdM(gpsAccuracyM: number): number {
  const accuracy = Number.isFinite(gpsAccuracyM) ? Math.max(gpsAccuracyM, 0) : 0;
  return Math.max(OFF_ROUTE_BASE_THRESHOLD_M, accuracy * OFF_ROUTE_ACCURACY_MULTIPLIER);
}

export function effectiveArrivalRadiusM(gpsAccuracyM: number): number {
  const accuracy = Number.isFinite(gpsAccuracyM) ? Math.max(gpsAccuracyM, 0) : 0;
  return Math.max(ARRIVAL_BASE_RADIUS_M, accuracy * 1.2);
}

export function isOffRoute(crossTrackMeters: number, gpsAccuracyM: number): boolean {
  return crossTrackMeters > effectiveOffRouteThresholdM(gpsAccuracyM);
}

export function shouldSnapToRoute(
  crossTrackMeters: number,
  gpsAccuracyM: number
): boolean {
  const snapLimit = Math.max(25, gpsAccuracyM * 1.5);
  return crossTrackMeters <= snapLimit;
}
