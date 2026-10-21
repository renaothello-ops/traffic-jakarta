import {
  applyRateLimit,
  isProduction,
  rateLimitHeaders,
  safeErrorMessage,
  safeUpstreamError,
} from "../server/apiSecurity.js";
import { googlePlacesApiKey } from "../server/envSecrets.js";
import {
  MAX_PLACES_QUERY_LENGTH,
  MAX_PLACES_TEXT_QUERY_LENGTH,
  parseLatitude,
  parseLongitude,
  parseMaxResultCount,
  parsePlaceId,
  parsePlacesAction,
  parsePlacesQuery,
  parsePlacesRadius,
  parsePlacesLanguageCode,
} from "../server/apiValidation.js";

type LatLng = { latitude: number; longitude: number };

type CircleBias = {
  circle: {
    center: LatLng;
    radius: number;
  };
};

const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types,suggestions.placePrediction.distanceMeters";

const TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types";

const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,primaryType,types";

function circleBias(lat: number, lng: number, radiusM: number): CircleBias {
  return {
    circle: {
      center: { latitude: lat, longitude: lng },
      radius: radiusM,
    },
  };
}

async function googlePost(
  path: string,
  body: Record<string, unknown>,
  fieldMask: string,
  apiKey: string
) {
  const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ??
      (data as { error?: string })?.error ??
      safeUpstreamError(res.status);
    throw new Error(String(message));
  }
  return data;
}

async function googleGetDetails(
  placeId: string,
  apiKey: string,
  sessionToken?: string,
  languageCode = "en"
) {
  const headers: Record<string, string> = {
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": DETAILS_FIELD_MASK,
  };
  if (sessionToken) {
    headers["X-Goog-Session-Token"] = sessionToken;
  }

  const lang = encodeURIComponent(languageCode);
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${lang}`,
    { headers }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ??
      safeUpstreamError(res.status);
    throw new Error(String(message));
  }
  return data;
}

function parseSessionToken(value: unknown): string | undefined {
  if (value == null) return undefined;
  const token = String(value).trim();
  if (!token || token.length > 256) return undefined;
  return token;
}

export default async function handler(req: { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> }, res: {
  status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void };
  setHeader: (name: string, value: string) => void;
}) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const limit = applyRateLimit(req, "places");
  for (const [name, value] of Object.entries(rateLimitHeaders(limit))) {
    res.setHeader(name, value);
  }
  if (!limit.allowed) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }

  const apiKey = googlePlacesApiKey();
  if (!apiKey) {
    res.status(503).json({
      error: "Search temporarily unavailable",
      code: "PLACES_UNAVAILABLE",
      reason: "missing_env",
    });
    return;
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body as Record<string, unknown>);
    const action = parsePlacesAction(body?.action);
    if (!action) {
      res.status(400).json({ error: "Unknown or missing action" });
      return;
    }

    if (action === "autocomplete") {
      const input = parsePlacesQuery(body.input, MAX_PLACES_QUERY_LENGTH);
      if (!input) {
        res.status(400).json({ error: "Invalid or missing input" });
        return;
      }

      const lat = parseLatitude(body.lat);
      const lng = parseLongitude(body.lng);
      if (lat == null || lng == null) {
        res.status(400).json({ error: "Invalid location bias coordinates" });
        return;
      }

      const originLat = parseLatitude(body.originLat ?? body.lat) ?? lat;
      const originLng = parseLongitude(body.originLng ?? body.lng) ?? lng;
      const radiusM = parsePlacesRadius(body.radiusM ?? 25_000) ?? 25_000;
      const sessionToken = parseSessionToken(body.sessionToken);

      const languageCode = parsePlacesLanguageCode(body.languageCode);

      const payload: Record<string, unknown> = {
        input,
        languageCode,
        regionCode: "id",
        includedRegionCodes: ["id"],
        origin: { latitude: originLat, longitude: originLng },
        locationBias: circleBias(lat, lng, radiusM),
      };
      if (sessionToken) payload.sessionToken = sessionToken;

      const data = await googlePost(
        "places:autocomplete",
        payload,
        AUTOCOMPLETE_FIELD_MASK,
        apiKey
      );

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(data);
      return;
    }

    if (action === "searchText") {
      const textQuery = parsePlacesQuery(body.textQuery, MAX_PLACES_TEXT_QUERY_LENGTH);
      if (!textQuery) {
        res.status(400).json({ error: "Invalid or missing textQuery" });
        return;
      }

      const lat = parseLatitude(body.lat);
      const lng = parseLongitude(body.lng);
      if (lat == null || lng == null) {
        res.status(400).json({ error: "Invalid location bias coordinates" });
        return;
      }

      const radiusM = parsePlacesRadius(body.radiusM ?? 12_000) ?? 12_000;
      const languageCode = parsePlacesLanguageCode(body.languageCode);

      const payload: Record<string, unknown> = {
        textQuery,
        languageCode,
        regionCode: "id",
        maxResultCount: parseMaxResultCount(body.maxResultCount),
        rankPreference: body.rankPreference === "RELEVANCE" ? "RELEVANCE" : "DISTANCE",
        locationBias: circleBias(lat, lng, radiusM),
      };

      const data = await googlePost(
        "places:searchText",
        payload,
        TEXT_SEARCH_FIELD_MASK,
        apiKey
      );

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(data);
      return;
    }

    if (action === "details") {
      const placeId = parsePlaceId(body.placeId);
      if (!placeId) {
        res.status(400).json({ error: "Invalid or missing placeId" });
        return;
      }

      const sessionToken = parseSessionToken(body.sessionToken);
      const languageCode = parsePlacesLanguageCode(body.languageCode);
      const data = await googleGetDetails(placeId, apiKey, sessionToken, languageCode);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(data);
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e: unknown) {
    const message = safeErrorMessage(e, "Places request failed");
    if (!isProduction() && e instanceof Error) {
      res.status(500).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
}
