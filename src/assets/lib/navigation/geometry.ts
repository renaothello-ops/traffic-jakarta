import { haversineMeters } from "../geo";

export type RouteMatch = {
  segmentIndex: number;
  /** Fraction along segment [0,1] */
  t: number;
  /** Closest point on route */
  lat: number;
  lng: number;
  /** Distance from query point to closest route point, meters */
  crossTrackMeters: number;
  /** Distance along full route from start to closest point, meters */
  distanceAlongMeters: number;
};

/** Nearest point on polyline + distance along route. */
export function matchToRoute(
  coordinates: Array<[number, number]>,
  lat: number,
  lng: number
): RouteMatch | null {
  if (coordinates.length < 2) return null;

  let best: RouteMatch | null = null;
  let accumulated = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[i + 1];
    const segLen = haversineMeters(lat1, lng1, lat2, lng2);
    const match = closestPointOnSegment(lat, lng, lat1, lng1, lat2, lng2);
    const cross = haversineMeters(lat, lng, match.lat, match.lng);
    const along = accumulated + segLen * match.t;

    if (!best || cross < best.crossTrackMeters) {
      best = {
        segmentIndex: i,
        t: match.t,
        lat: match.lat,
        lng: match.lng,
        crossTrackMeters: cross,
        distanceAlongMeters: along,
      };
    }
    accumulated += segLen;
  }

  return best;
}

function closestPointOnSegment(
  lat: number,
  lng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { lat: number; lng: number; t: number } {
  const dx = lng2 - lng1;
  const dy = lat2 - lat1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { lat: lat1, lng: lng1, t: 0 };

  let t = ((lng - lng1) * dx + (lat - lat1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    lat: lat1 + t * dy,
    lng: lng1 + t * dx,
    t,
  };
}

/** Bearing degrees [0,360) from point A to B. */
export function bearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => ((r * 180) / Math.PI + 360) % 360;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return toDeg(Math.atan2(y, x));
}

/** Smooth bearing transition. */
export function lerpBearing(from: number, to: number, alpha: number): number {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * alpha + 360) % 360;
}

export function sliceRouteCoordinates(
  coordinates: Array<[number, number]>,
  match: RouteMatch
): { completed: Array<[number, number]>; remaining: Array<[number, number]> } {
  const { segmentIndex, t, lat, lng } = match;
  const pivot: [number, number] = [lng, lat];
  const completed = coordinates.slice(0, segmentIndex + 1);
  if (t > 0.001) completed.push(pivot);
  const remaining: Array<[number, number]> = [pivot, ...coordinates.slice(segmentIndex + 1)];
  if (remaining.length < 2) remaining.unshift(completed[completed.length - 1] ?? pivot);
  return { completed, remaining };
}

/** Reject implausible GPS jumps. */
export function isPlausibleGpsJump(
  prev: { lat: number; lng: number; timestamp: number } | null,
  next: { lat: number; lng: number; timestamp: number },
  maxSpeedMps = 55
): boolean {
  if (!prev) return true;
  const dt = (next.timestamp - prev.timestamp) / 1000;
  if (dt <= 0) return false;
  const dist = haversineMeters(prev.lat, prev.lng, next.lat, next.lng);
  return dist / dt <= maxSpeedMps;
}
