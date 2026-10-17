import {
  parseLatitude,
  parseLongitude,
} from "./apiValidation.js";

export type TomTomSegmentResponse = {
  currentSpeedKph: number | null;
  freeFlowSpeedKph: number | null;
  confidence: number | null;
  roadClosure: boolean | null;
  observedAt: number | null;
};

export async function fetchTomTomFlowSegment(
  latRaw: string | null | undefined,
  lngRaw: string | null | undefined
): Promise<TomTomSegmentResponse | null> {
  const lat = parseLatitude(latRaw);
  const lng = parseLongitude(lngRaw);
  if (lat == null || lng == null) return null;

  const key = process.env.TOMTOM_API_KEY;
  if (!key) return null;

  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${encodeURIComponent(
    key
  )}&point=${lat},${lng}&unit=KMPH`;

  const r = await fetch(url);
  if (!r.ok) return null;

  const data = (await r.json()) as {
    flowSegmentData?: {
      currentSpeed?: number;
      freeFlowSpeed?: number;
      confidence?: number;
      roadClosure?: boolean;
      coordinates?: { coordinate?: unknown[] };
    };
  };

  const seg = data.flowSegmentData;
  if (!seg) return null;

  return {
    currentSpeedKph:
      typeof seg.currentSpeed === "number" ? seg.currentSpeed : null,
    freeFlowSpeedKph:
      typeof seg.freeFlowSpeed === "number" ? seg.freeFlowSpeed : null,
    confidence: typeof seg.confidence === "number" ? seg.confidence : null,
    roadClosure: typeof seg.roadClosure === "boolean" ? seg.roadClosure : null,
    observedAt: Date.now(),
  };
}
