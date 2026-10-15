import type { GpsFix } from "../../../types";
import { haversineMeters } from "../geo";
import { bearingDegrees } from "./geometry";

/** DEV ONLY — advance a fake GPS fix along route coordinates. */
export function advanceSimulationFix(
  coordinates: Array<[number, number]>,
  prev: { segmentIndex: number; t: number } | null,
  speedMps = 15
): { fix: GpsFix; cursor: { segmentIndex: number; t: number } } | null {
  if (coordinates.length < 2) return null;

  let seg = prev?.segmentIndex ?? 0;
  let t = prev?.t ?? 0;

  let remaining = speedMps;
  while (remaining > 0 && seg < coordinates.length - 1) {
    const [lng1, lat1] = coordinates[seg];
    const [lng2, lat2] = coordinates[seg + 1];
    const segLen = haversineMeters(lat1, lng1, lat2, lng2);
    if (segLen < 0.5) {
      seg++;
      t = 0;
      continue;
    }
    const distLeftOnSeg = segLen * (1 - t);
    if (remaining >= distLeftOnSeg) {
      remaining -= distLeftOnSeg;
      seg++;
      t = 0;
    } else {
      t += remaining / segLen;
      remaining = 0;
    }
  }

  if (seg >= coordinates.length - 1) {
    const last = coordinates[coordinates.length - 1];
    return {
      fix: {
        lat: last[1],
        lng: last[0],
        accuracy: 8,
        speed: speedMps,
        heading: null,
        timestamp: Date.now(),
      },
      cursor: { segmentIndex: coordinates.length - 2, t: 1 },
    };
  }

  const [lng1, lat1] = coordinates[seg];
  const [lng2, lat2] = coordinates[seg + 1];
  const lat = lat1 + (lat2 - lat1) * t;
  const lng = lng1 + (lng2 - lng1) * t;

  return {
    fix: {
      lat,
      lng,
      accuracy: 8,
      speed: speedMps,
      heading: bearingDegrees(lat1, lng1, lat2, lng2),
      timestamp: Date.now(),
    },
    cursor: { segmentIndex: seg, t },
  };
}

export function isNavSimulationEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem("tj_nav_sim") === "1";
  } catch {
    return false;
  }
}

export function setNavSimulationEnabled(on: boolean): void {
  if (!import.meta.env.DEV) return;
  try {
    if (on) localStorage.setItem("tj_nav_sim", "1");
    else localStorage.removeItem("tj_nav_sim");
  } catch {
    // ignore
  }
}
