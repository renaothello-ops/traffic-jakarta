import { tomtomApiKey } from "./envSecrets.js";

export type RoutePoint = { latitude: number; longitude: number };

export type TomTomInstruction = {
  routeOffsetInMeters?: number;
  distanceInMeters?: number;
  travelTimeInSeconds?: number;
  point?: RoutePoint;
  maneuver?: string;
  message?: string;
  street?: string;
  combineWithNext?: boolean;
};

export type NormalizedRouteResponse = {
  routes: Array<{
    summary: {
      lengthInMeters: number;
      travelTimeInSeconds: number;
      trafficDelaySeconds?: number;
    };
    legs: Array<{ points?: RoutePoint[] }>;
    guidance?: {
      instructions?: TomTomInstruction[];
    };
  }>;
  provider: "tomtom" | "osrm-fallback";
  tomtomHttpStatus?: number;
  tomtomErrorMessage?: string;
};

type RouteParams = {
  originLat: string;
  originLng: string;
  destLat: string;
  destLng: string;
};

function parseTomTomError(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const err = data as {
    detailedError?: { message?: string; code?: string };
    error?: string;
  };
  return err.detailedError?.message ?? err.error;
}

async function fetchTomTomRoute(
  key: string,
  params: RouteParams
): Promise<{ status: number; data: unknown }> {
  const locations = `${params.originLat},${params.originLng}:${params.destLat},${params.destLng}`;
  const query = new URLSearchParams({
    key,
    traffic: "true",
    travelMode: "car",
    maxAlternatives: "2",
    routeRepresentation: "summary,polyline",
    instructionsType: "tagged",
    language: "en-US",
  });

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?${query}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Decode TomTom/Google encoded polyline to lat/lng points. */
function decodePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

function normalizeTomTomRoutes(data: unknown): NormalizedRouteResponse["routes"] {
  const routes = (data as { routes?: Array<Record<string, unknown>> })?.routes ?? [];

  return routes.map((route) => {
    const summary = route.summary as NormalizedRouteResponse["routes"][0]["summary"];
    const legs = (route.legs as Array<Record<string, unknown>>) ?? [];
    const normalizedLegs = legs.map((leg) => {
      const rawPoints = leg.points as
        | RoutePoint[]
        | { latitude: number; longitude: number }[]
        | undefined;
      if (Array.isArray(rawPoints) && rawPoints.length > 0) {
        return {
          points: rawPoints.map((p) => ({
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
          })),
        };
      }

      const polyline = leg.polyline as string | undefined;
      if (typeof polyline === "string" && polyline.length > 0) {
        return { points: decodePolyline(polyline) };
      }

      return { points: [] as RoutePoint[] };
    });

    const routeLevelPolyline = route.polyline as string | undefined;
    if (
      normalizedLegs.every((l) => !l.points?.length) &&
      typeof routeLevelPolyline === "string"
    ) {
      normalizedLegs[0] = { points: decodePolyline(routeLevelPolyline) };
    }

    const guidance = route.guidance as
      | { instructions?: TomTomInstruction[] }
      | undefined;

    return {
      summary,
      legs: normalizedLegs,
      guidance: guidance?.instructions?.length
        ? { instructions: guidance.instructions }
        : undefined,
    };
  });
}

async function fetchOsrmFallback(params: RouteParams): Promise<NormalizedRouteResponse> {
  const { originLat, originLng, destLat, destLng } = params;
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${originLng},${originLat};${destLng},${destLat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: Array<[number, number]> };
    }>;
    message?: string;
  };

  if (!res.ok || data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(data.message ?? "Fallback routing failed");
  }

  const route = data.routes[0];
  const coordinates = route.geometry?.coordinates ?? [];
  const points: RoutePoint[] = coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  return {
    provider: "osrm-fallback",
    routes: [
      {
        summary: {
          lengthInMeters: Math.round(route.distance ?? 0),
          travelTimeInSeconds: Math.round(route.duration ?? 0),
          trafficDelaySeconds: 0,
        },
        legs: [{ points }],
      },
    ],
  };
}

export async function calculateRouteProxy(
  params: RouteParams
): Promise<NormalizedRouteResponse> {
  const key = tomtomApiKey();
  const tomtomKeyAvailable = Boolean(key);

  if (!tomtomKeyAvailable) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[route-proxy] TOMTOM_KEY_AVAILABLE=false");
    }
    throw new Error("Routing is not configured (missing TOMTOM_API_KEY)");
  }

  const { status, data } = await fetchTomTomRoute(key!, params);
  const tomtomErrorMessage = parseTomTomError(data);

  if (status === 200) {
    const routes = normalizeTomTomRoutes(data);
    const hasGeometry = routes.some((r) =>
      r.legs.some((leg) => (leg.points?.length ?? 0) > 0)
    );
    if (hasGeometry && routes.length > 0) {
      return {
        provider: "tomtom",
        routes,
        tomtomHttpStatus: status,
      };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[route-proxy] TomTom routing unavailable, using OSRM fallback", {
      TOMTOM_KEY_AVAILABLE: true,
      ROUTE_HTTP_STATUS: status,
      TOMTOM_ERROR_MESSAGE: tomtomErrorMessage ?? null,
    });
  }

  if (status === 403 || status === 401) {
    const fallback = await fetchOsrmFallback(params);
    return {
      ...fallback,
      tomtomHttpStatus: status,
      tomtomErrorMessage,
    };
  }

  throw new Error(tomtomErrorMessage ?? `Routing failed (HTTP ${status})`);
}

export function logRouteDiagnostics(
  params: RouteParams,
  result: NormalizedRouteResponse | null,
  error?: unknown
): void {
  if (process.env.NODE_ENV === "production") return;

  const diagnostic = {
    ROUTE_ORIGIN: `${params.originLat},${params.originLng}`,
    ROUTE_DESTINATION: `${params.destLat},${params.destLng}`,
    ROUTE_API_ENDPOINT: "/api/tomtom-route",
    TOMTOM_KEY_AVAILABLE: Boolean(tomtomApiKey()),
    ROUTE_HTTP_STATUS: result?.tomtomHttpStatus ?? null,
    TOMTOM_ERROR_CODE: result?.tomtomHttpStatus === 403 ? "Forbidden" : null,
    TOMTOM_ERROR_MESSAGE: result?.tomtomErrorMessage ?? null,
    TOMTOM_ROUTES_COUNT: result?.routes.length ?? 0,
    ROUTE_PROVIDER: result?.provider ?? null,
    ROUTE_ERROR: error instanceof Error ? error.message : null,
  };

  console.info("[route-proxy]", diagnostic);
}
