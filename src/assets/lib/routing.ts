import type { Destination, RouteInstruction, RouteOption, RoutePlan } from "../../types";
import { mapTomTomManeuver } from "./navigation/maneuvers";

type TomTomPoint = { latitude: number; longitude: number };

type TomTomInstruction = {
  routeOffsetInMeters?: number;
  distanceInMeters?: number;
  point?: TomTomPoint;
  maneuver?: string;
  message?: string;
  street?: string;
};

type TomTomRoute = {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds?: number;
  };
  legs: Array<{ points?: TomTomPoint[] }>;
  guidance?: { instructions?: TomTomInstruction[] };
};

type TomTomRouteResponse = {
  routes?: TomTomRoute[];
  error?: string;
  detailedError?: { message?: string };
  meta?: { provider?: "tomtom" | "osrm-fallback" };
};

function pointsToCoords(points: TomTomPoint[]): Array<[number, number]> {
  return points.map((p) => [p.longitude, p.latitude]);
}

function parseTomTomInstructions(
  raw: TomTomInstruction[] | undefined,
  totalDistanceM: number
): RouteInstruction[] {
  const list = raw ?? [];
  if (list.length === 0) {
    return [
      {
        index: 0,
        maneuver: "straight",
        message: "Follow the route",
        routeOffsetMeters: 0,
        stepDistanceMeters: totalDistanceM,
        point: { lat: 0, lng: 0 },
      },
    ];
  }

  return list.map((ins, index) => {
    const next = list[index + 1];
    const offset = ins.routeOffsetInMeters ?? 0;
    const nextOffset = next?.routeOffsetInMeters ?? totalDistanceM;
    return {
      index,
      maneuver: mapTomTomManeuver(ins.maneuver),
      message: ins.message ?? "",
      street: ins.street,
      routeOffsetMeters: offset,
      stepDistanceMeters: Math.max(0, nextOffset - offset),
      point: {
        lat: ins.point?.latitude ?? 0,
        lng: ins.point?.longitude ?? 0,
      },
    };
  });
}

function synthesizeInstructionsFromGeometry(
  coordinates: Array<[number, number]>,
  totalDistanceM: number
): RouteInstruction[] {
  if (coordinates.length < 2) {
    return [
      {
        index: 0,
        maneuver: "straight",
        message: "Follow the route",
        routeOffsetMeters: 0,
        stepDistanceMeters: totalDistanceM,
        point: { lat: coordinates[0]?.[1] ?? 0, lng: coordinates[0]?.[0] ?? 0 },
      },
      {
        index: 1,
        maneuver: "arrive",
        message: "You have arrived",
        routeOffsetMeters: totalDistanceM,
        stepDistanceMeters: 0,
        point: {
          lat: coordinates[coordinates.length - 1]?.[1] ?? 0,
          lng: coordinates[coordinates.length - 1]?.[0] ?? 0,
        },
      },
    ];
  }

  return [
    {
      index: 0,
      maneuver: "depart",
      message: "Head toward destination",
      routeOffsetMeters: 0,
      stepDistanceMeters: totalDistanceM,
      point: { lat: coordinates[0][1], lng: coordinates[0][0] },
    },
    {
      index: 1,
      maneuver: "arrive",
      message: "You have arrived",
      routeOffsetMeters: totalDistanceM,
      stepDistanceMeters: 0,
      point: {
        lat: coordinates[coordinates.length - 1][1],
        lng: coordinates[coordinates.length - 1][0],
      },
    },
  ];
}

function parseRoutes(data: TomTomRouteResponse): RouteOption[] {
  const routes = data.routes ?? [];
  const labels = ["Fastest", "Alternative", "Alternative 2"];
  const provider = data.meta?.provider ?? "tomtom";

  return routes.map((route, index) => {
    const allPoints: TomTomPoint[] = [];
    for (const leg of route.legs ?? []) {
      if (leg.points) allPoints.push(...leg.points);
    }
    const coordinates = pointsToCoords(allPoints);
    const totalDistanceM = route.summary.lengthInMeters;
    const instructions =
      provider === "tomtom" && route.guidance?.instructions?.length
        ? parseTomTomInstructions(route.guidance.instructions, totalDistanceM)
        : synthesizeInstructionsFromGeometry(coordinates, totalDistanceM);

    return {
      id: `route-${index}`,
      label: labels[index] ?? `Route ${index + 1}`,
      distanceMeters: totalDistanceM,
      durationSeconds: route.summary.travelTimeInSeconds,
      trafficDelaySeconds: route.summary.trafficDelayInSeconds ?? 0,
      coordinates,
      instructions,
    };
  });
}

function logRouteClientDiagnostic(info: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[route-client]", info);
}

export async function calculateRoute(
  origin: { lat: number; lng: number },
  destination: Destination
): Promise<RoutePlan> {
  const params = new URLSearchParams({
    originLat: String(origin.lat),
    originLng: String(origin.lng),
    destLat: String(destination.lat),
    destLng: String(destination.lng),
  });

  const endpoint = `/api/tomtom-route?${params}`;

  logRouteClientDiagnostic({
    ROUTE_ORIGIN: `${origin.lat},${origin.lng}`,
    ROUTE_DESTINATION: `${destination.lat},${destination.lng}`,
    ROUTE_API_ENDPOINT: endpoint,
  });

  const res = await fetch(endpoint);
  const data = (await res.json()) as TomTomRouteResponse & {
    error?: string;
    meta?: { provider?: "tomtom" | "osrm-fallback" };
  };

  if (!res.ok) {
    logRouteClientDiagnostic({
      ROUTE_HTTP_STATUS: res.status,
      ROUTE_ERROR: data.error ?? null,
    });
    throw new Error(data.error ?? "Could not calculate route");
  }

  const routes = parseRoutes(data);
  if (routes.length === 0 || routes.every((r) => r.coordinates.length < 2)) {
    throw new Error("No route found for this destination");
  }

  logRouteClientDiagnostic({
    ROUTE_HTTP_STATUS: res.status,
    TOMTOM_ROUTES_COUNT: routes.length,
    ROUTE_PROVIDER: data.meta?.provider ?? "tomtom",
    ROUTE_POINTS: routes[0]?.coordinates.length ?? 0,
    ROUTE_INSTRUCTIONS: routes[0]?.instructions.length ?? 0,
  });

  return {
    origin,
    destination,
    routes,
    selectedIndex: 0,
    provider: data.meta?.provider ?? "tomtom",
  };
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatDistanceKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatArrivalTime(secondsFromNow: number): string {
  const d = new Date(Date.now() + secondsFromNow * 1000);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function getRouteBounds(
  plan: RoutePlan
): [[number, number], [number, number]] | null {
  const route = plan.routes[plan.selectedIndex];
  if (!route || route.coordinates.length === 0) return null;

  const lngs = route.coordinates.map((c) => c[0]);
  const lats = route.coordinates.map((c) => c[1]);
  lngs.push(plan.origin.lng, plan.destination.lng);
  lats.push(plan.origin.lat, plan.destination.lat);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function startExternalNavigation(
  origin: { lat: number; lng: number } | null,
  destination: Destination
): void {
  const dest = `${destination.lat},${destination.lng}`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  let url: string;
  if (origin) {
    const orig = `${origin.lat},${origin.lng}`;
    url = `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}&travelmode=driving`;
  } else {
    url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  }

  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
