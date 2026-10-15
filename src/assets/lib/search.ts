import { haversineMeters, formatDistance } from "./geo";

const JAKARTA = { lat: -6.2, lng: 106.8 };

export type SearchContext = {
  originLat?: number | null;
  originLng?: number | null;
  mapCenterLat: number;
  mapCenterLng: number;
};

export type Suggestion = {
  placeId: string;
  title: string;
  subtitle?: string;
  lat?: number;
  lng?: number;
  distanceM?: number;
};

export type PlaceDetails = {
  placeId: string;
  title: string;
  address?: string;
  lat: number;
  lng: number;
  distanceM?: number;
};

const GENERIC_TERMS = new Set([
  "cafe",
  "cafes",
  "coffee",
  "restaurant",
  "restaurants",
  "hospital",
  "hospitals",
  "atm",
  "atms",
  "gas",
  "gas station",
  "mall",
  "malls",
  "pharmacy",
  "bank",
  "hotel",
  "school",
  "starbucks",
  "indomaret",
  "alfamart",
]);

let activeSessionToken: string | null = null;

export function resetPlacesSession(): void {
  activeSessionToken = null;
}

function getPlacesSession(): string {
  if (!activeSessionToken) {
    activeSessionToken = crypto.randomUUID();
  }
  return activeSessionToken;
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isGenericSearchQuery(query: string): boolean {
  const n = normalizeQuery(query);
  if (GENERIC_TERMS.has(n)) return true;
  return /\b(restaurant|cafe|hospital|atm|hotel|school|mall)\b/i.test(n);
}

function resolveBias(context: SearchContext): {
  lat: number;
  lng: number;
  originLat: number;
  originLng: number;
} {
  const hasGps =
    context.originLat != null &&
    context.originLng != null &&
    Number.isFinite(context.originLat) &&
    Number.isFinite(context.originLng);

  if (hasGps) {
    return {
      lat: context.originLat!,
      lng: context.originLng!,
      originLat: context.originLat!,
      originLng: context.originLng!,
    };
  }

  if (
    Number.isFinite(context.mapCenterLat) &&
    Number.isFinite(context.mapCenterLng)
  ) {
    return {
      lat: context.mapCenterLat,
      lng: context.mapCenterLng,
      originLat: context.mapCenterLat,
      originLng: context.mapCenterLng,
    };
  }

  return {
    lat: JAKARTA.lat,
    lng: JAKARTA.lng,
    originLat: JAKARTA.lat,
    originLng: JAKARTA.lng,
  };
}

function shortArea(formattedAddress?: string): string | undefined {
  if (!formattedAddress) return undefined;
  const parts = formattedAddress.split(",").map((p) => p.trim());
  if (parts.length <= 2) return formattedAddress;
  return parts.slice(0, 2).join(", ");
}

export class PlacesSearchUnavailableError extends Error {
  readonly status: number;
  readonly googleMessage?: string;

  constructor(status: number, googleMessage?: string) {
    super("Search temporarily unavailable");
    this.name = "PlacesSearchUnavailableError";
    this.status = status;
    this.googleMessage = googleMessage;
  }
}

function logPlacesDiagnostic(info: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[places-search]", info);
}

async function postPlaces(
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<unknown> {
  const endpoint = "/api/places";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  const googleMessage =
    (data as { error?: { message?: string } })?.error?.message ??
    (typeof (data as { error?: string }).error === "string"
      ? (data as { error: string }).error
      : undefined);

  if (!res.ok) {
    logPlacesDiagnostic({
      endpoint,
      action: payload.action,
      httpStatus: res.status,
      googleMessage: googleMessage ?? null,
      envKeyConfigured: null,
    });
    throw new PlacesSearchUnavailableError(res.status, googleMessage);
  }

  logPlacesDiagnostic({
    endpoint,
    action: payload.action,
    httpStatus: res.status,
    googleMessage: null,
  });

  return data;
}

type AutocompletePrediction = {
  placeId?: string;
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
  distanceMeters?: number;
};

function mapAutocompleteSuggestions(data: unknown): Suggestion[] {
  const suggestions =
    (data as { suggestions?: Array<{ placePrediction?: AutocompletePrediction }> })
      ?.suggestions ?? [];

  return suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is AutocompletePrediction => Boolean(p?.placeId))
    .map((p) => {
      const title = p.structuredFormat?.mainText?.text ?? "Unknown place";
      const subtitle = p.structuredFormat?.secondaryText?.text;
      return {
        placeId: p.placeId!,
        title,
        subtitle: shortArea(subtitle) ?? subtitle,
        distanceM: p.distanceMeters,
      };
    })
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
}

type TextSearchPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
};

function mapTextSearchResults(
  data: unknown,
  originLat: number,
  originLng: number
): Suggestion[] {
  const places = (data as { places?: TextSearchPlace[] })?.places ?? [];

  return places
    .filter(
      (p) =>
        p.id &&
        p.location?.latitude != null &&
        p.location?.longitude != null
    )
    .map((p) => {
      const lat = p.location!.latitude!;
      const lng = p.location!.longitude!;
      return {
        placeId: p.id!.replace(/^places\//, ""),
        title: p.displayName?.text ?? "Unknown place",
        subtitle: shortArea(p.formattedAddress) ?? p.formattedAddress,
        lat,
        lng,
        distanceM: haversineMeters(originLat, originLng, lat, lng),
      };
    })
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
}

async function autocomplete(
  query: string,
  context: SearchContext,
  signal?: AbortSignal
): Promise<Suggestion[]> {
  const bias = resolveBias(context);
  const generic = isGenericSearchQuery(query);

  const data = await postPlaces(
    {
      action: "autocomplete",
      input: query,
      lat: bias.lat,
      lng: bias.lng,
      originLat: bias.originLat,
      originLng: bias.originLng,
      radiusM: generic ? 12000 : 35000,
      sessionToken: getPlacesSession(),
    },
    signal
  );

  return mapAutocompleteSuggestions(data);
}

async function textSearch(
  query: string,
  context: SearchContext,
  signal?: AbortSignal
): Promise<Suggestion[]> {
  const bias = resolveBias(context);

  const data = await postPlaces(
    {
      action: "searchText",
      textQuery: query,
      lat: bias.lat,
      lng: bias.lng,
      radiusM: 12000,
      rankPreference: "DISTANCE",
      maxResultCount: 10,
    },
    signal
  );

  return mapTextSearchResults(data, bias.originLat, bias.originLng);
}

/** Search places — generic queries use nearby Text Search; named queries use Autocomplete. */
export async function suggest(
  query: string,
  context: SearchContext,
  signal?: AbortSignal
): Promise<Suggestion[]> {
  const q = query.trim();
  if (!q) return [];

  if (isGenericSearchQuery(q)) {
    return textSearch(q, context, signal);
  }

  return autocomplete(q, context, signal);
}

export async function fetchPlaceDetails(
  placeId: string,
  context: SearchContext,
  signal?: AbortSignal
): Promise<PlaceDetails> {
  const bias = resolveBias(context);
  const sessionToken = getPlacesSession();

  const data = await postPlaces(
    { action: "details", placeId, sessionToken },
    signal
  );

  resetPlacesSession();

  const place = data as TextSearchPlace & { id?: string };
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  if (lat == null || lng == null) {
    throw new Error("Place has no coordinates");
  }

  return {
    placeId: (place.id ?? placeId).replace(/^places\//, ""),
    title: place.displayName?.text ?? "Selected place",
    address: place.formattedAddress,
    lat,
    lng,
    distanceM: haversineMeters(bias.originLat, bias.originLng, lat, lng),
  };
}

export function formatSuggestionDistance(distanceM?: number): string | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  return formatDistance(distanceM);
}
