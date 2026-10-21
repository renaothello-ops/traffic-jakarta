/**
 * Shared production API router (Firebase Functions + Vite dev server).
 * No open proxy — fixed TomTom / Google Places paths only.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { calculateRouteProxy, logRouteDiagnostics } from "./calculateRoute.js";
import { fetchTomTomFlowSegment } from "./tomtomFlowSegment.js";
import {
  applyRateLimit,
  rateLimitHeaders,
  safeErrorMessage,
  safeUpstreamError,
} from "./apiSecurity.js";
import { handleAnalyzeReportHttp } from "./analyzeReport.js";
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
  parseRouteCoordinatePair,
  parseTileIndex,
  parseTileMode,
  parseTileZoom,
} from "./apiValidation.js";

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function setJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/** @returns true if request was handled */
export async function handleApiHttp(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (url === "/api/places" && method === "POST") {
    const placesLimit = applyRateLimit({ headers: req.headers }, "places");
    for (const [name, value] of Object.entries(rateLimitHeaders(placesLimit))) {
      res.setHeader(name, value);
    }
    if (!placesLimit.allowed) {
      setJson(res, 429, { error: "Too many requests. Please try again shortly." });
      return true;
    }

    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      setJson(res, 503, {
        error: "Search temporarily unavailable",
        code: "PLACES_UNAVAILABLE",
      });
      return true;
    }

    try {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const action = parsePlacesAction(body?.action);
      if (!action) {
        setJson(res, 400, { error: "Unknown or missing action" });
        return true;
      }
      const googlePostHeaders = (fieldMask: string) => ({
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
      });

      if (action === "autocomplete") {
        const input = parsePlacesQuery(body.input, MAX_PLACES_QUERY_LENGTH);
        const lat = parseLatitude(body.lat);
        const lng = parseLongitude(body.lng);
        if (!input || lat == null || lng == null) {
          setJson(res, 400, { error: "Invalid autocomplete parameters" });
          return true;
        }
        const radiusM = parsePlacesRadius(body.radiusM ?? 25_000) ?? 25_000;
        const upstream = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: googlePostHeaders(
              "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types,suggestions.placePrediction.distanceMeters"
            ),
            body: JSON.stringify({
              input,
              languageCode: parsePlacesLanguageCode(body.languageCode),
              regionCode: "id",
              includedRegionCodes: ["id"],
              sessionToken: body.sessionToken,
              origin: {
                latitude: parseLatitude(body.originLat ?? body.lat) ?? lat,
                longitude: parseLongitude(body.originLng ?? body.lng) ?? lng,
              },
              locationBias: {
                circle: {
                  center: { latitude: lat, longitude: lng },
                  radius: radiusM,
                },
              },
            }),
          }
        );
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(text);
        return true;
      }

      if (action === "searchText") {
        const textQuery = parsePlacesQuery(body.textQuery, MAX_PLACES_TEXT_QUERY_LENGTH);
        const lat = parseLatitude(body.lat);
        const lng = parseLongitude(body.lng);
        if (!textQuery || lat == null || lng == null) {
          setJson(res, 400, { error: "Invalid searchText parameters" });
          return true;
        }
        const radiusM = parsePlacesRadius(body.radiusM ?? 12_000) ?? 12_000;
        const upstream = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: googlePostHeaders(
              "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types"
            ),
            body: JSON.stringify({
              textQuery,
              languageCode: parsePlacesLanguageCode(body.languageCode),
              regionCode: "id",
              maxResultCount: parseMaxResultCount(body.maxResultCount),
              rankPreference:
                body.rankPreference === "RELEVANCE" ? "RELEVANCE" : "DISTANCE",
              locationBias: {
                circle: {
                  center: { latitude: lat, longitude: lng },
                  radius: radiusM,
                },
              },
            }),
          }
        );
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(text);
        return true;
      }

      if (action === "details") {
        const parsedPlaceId = parsePlaceId(body.placeId);
        if (!parsedPlaceId) {
          setJson(res, 400, { error: "Invalid or missing placeId" });
          return true;
        }
        const placeId = encodeURIComponent(parsedPlaceId);
        const upstream = await fetch(
          `https://places.googleapis.com/v1/places/${placeId}`,
          {
            headers: {
              ...googlePostHeaders(
                "id,displayName,formattedAddress,location,primaryType,types"
              ),
              ...(body.sessionToken
                ? { "X-Goog-Session-Token": String(body.sessionToken) }
                : {}),
            },
          }
        );
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(text);
        return true;
      }

      setJson(res, 400, { error: "Unknown action" });
      return true;
    } catch (e: unknown) {
      setJson(res, 500, { error: safeErrorMessage(e, "Server error") });
      return true;
    }
  }

  const queryMatch = url.match(/^\/api\/tomtom-flow\.png\?(.+)$/);
  if (queryMatch) {
    const tileLimit = applyRateLimit({ headers: req.headers }, "trafficTile");
    for (const [name, value] of Object.entries(rateLimitHeaders(tileLimit))) {
      res.setHeader(name, value);
    }
    if (!tileLimit.allowed) {
      res.statusCode = 429;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Too many traffic tile requests");
      return true;
    }

    const params = new URLSearchParams(queryMatch[1]);
    const mode = parseTileMode(params.get("mode"));
    const zoom = parseTileZoom(params.get("z"));
    const tileX = zoom != null ? parseTileIndex(params.get("x"), zoom) : null;
    const tileY = zoom != null ? parseTileIndex(params.get("y"), zoom) : null;

    if (mode && zoom != null && tileX != null && tileY != null) {
      const key = process.env.TOMTOM_API_KEY;
      if (!key) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("Traffic overlay unavailable");
        return true;
      }

      const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/${mode}/${zoom}/${tileX}/${tileY}.png?key=${encodeURIComponent(key)}`;
      try {
        const r = await fetch(upstream);
        const buf = Buffer.from(await r.arrayBuffer());
        res.statusCode = r.status;
        res.setHeader("content-type", r.ok ? "image/png" : "text/plain; charset=utf-8");
        if (!r.ok) {
          res.end(safeUpstreamError(r.status));
          return true;
        }
        res.end(buf);
      } catch (e: unknown) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end(String(e instanceof Error ? e.message : e));
      }
      return true;
    }
  }

  const segmentMatch = url.match(/^\/api\/tomtom-flow-segment\?(.+)$/);
  if (segmentMatch) {
    const segmentLimit = applyRateLimit({ headers: req.headers }, "trafficSegment");
    for (const [name, value] of Object.entries(rateLimitHeaders(segmentLimit))) {
      res.setHeader(name, value);
    }
    if (!segmentLimit.allowed) {
      setJson(res, 429, { error: "Too many requests" });
      return true;
    }
    const q = new URLSearchParams(segmentMatch[1]);
    try {
      const payload = await fetchTomTomFlowSegment(q.get("lat"), q.get("lng"));
      if (!payload) {
        setJson(res, 503, { error: "Traffic segment unavailable" });
        return true;
      }
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "private, max-age=30");
      res.end(JSON.stringify(payload));
    } catch (e: unknown) {
      setJson(res, 500, { error: safeErrorMessage(e, "Server error") });
    }
    return true;
  }

  const routeMatch = url.match(/^\/api\/tomtom-route\?(.+)$/);
  if (routeMatch) {
    const routeLimit = applyRateLimit({ headers: req.headers }, "routing");
    for (const [name, value] of Object.entries(rateLimitHeaders(routeLimit))) {
      res.setHeader(name, value);
    }
    if (!routeLimit.allowed) {
      setJson(res, 429, {
        error: "Too many route requests. Please try again shortly.",
      });
      return true;
    }

    const q = new URLSearchParams(routeMatch[1]);
    const coords = parseRouteCoordinatePair(
      q.get("originLat"),
      q.get("originLng"),
      q.get("destLat"),
      q.get("destLng")
    );

    if (coords) {
      const params = {
        originLat: String(coords.originLat),
        originLng: String(coords.originLng),
        destLat: String(coords.destLat),
        destLng: String(coords.destLng),
      };
      try {
        const result = await calculateRouteProxy(params);
        logRouteDiagnostics(params, result);
        setJson(res, 200, {
          routes: result.routes,
          meta: { provider: result.provider },
        });
      } catch (e: unknown) {
        logRouteDiagnostics(params, null, e);
        setJson(res, 502, { error: safeErrorMessage(e, "Routing failed") });
      }
      return true;
    }

    setJson(res, 400, { error: "Invalid origin or destination coordinates" });
    return true;
  }

  const legacyTile = url.match(
    /^\/api\/tomtom\/flow\/(relative|absolute)\/(\d+)\/(\d+)\/(\d+)\.png$/
  );
  if (legacyTile) {
    const tileLimit = applyRateLimit({ headers: req.headers }, "trafficTile");
    for (const [name, value] of Object.entries(rateLimitHeaders(tileLimit))) {
      res.setHeader(name, value);
    }
    if (!tileLimit.allowed) {
      res.statusCode = 429;
      res.end("Too many traffic tile requests");
      return true;
    }
    const style = parseTileMode(legacyTile[1]);
    const zoom = parseTileZoom(legacyTile[2]);
    const tileX = zoom != null ? parseTileIndex(legacyTile[3], zoom) : null;
    const tileY = zoom != null ? parseTileIndex(legacyTile[4], zoom) : null;
    const key = process.env.TOMTOM_API_KEY;
    if (!key || !style || zoom == null || tileX == null || tileY == null) {
      res.statusCode = 400;
      res.end("Invalid tile coordinates");
      return true;
    }
    const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${zoom}/${tileX}/${tileY}.png?key=${encodeURIComponent(key)}`;
    const r = await fetch(upstream);
    const buf = Buffer.from(await r.arrayBuffer());
    res.statusCode = r.status;
    res.setHeader("content-type", r.ok ? "image/png" : "application/json; charset=utf-8");
    res.end(buf);
    return true;
  }

  if (url === "/api/analyze-report" && method === "POST") {
    const raw = await readRequestBody(req);
    await handleAnalyzeReportHttp(req, res, raw);
    return true;
  }

  if (url.startsWith("/api/")) {
    setJson(res, 404, { error: "Unknown API route" });
    return true;
  }

  return false;
}
