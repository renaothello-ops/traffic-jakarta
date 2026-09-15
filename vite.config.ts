import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import {
  calculateRouteProxy,
  logRouteDiagnostics,
} from "./server/calculateRoute";
import {
  applyRateLimit,
  rateLimitHeaders,
  safeErrorMessage,
  safeUpstreamError,
} from "./server/apiSecurity";
import {
  parseLatitude,
  parseLongitude,
  parseMaxResultCount,
  parsePlaceId,
  parsePlacesAction,
  parsePlacesQuery,
  parsePlacesRadius,
  parseRouteCoordinatePair,
  parseTileIndex,
  parseTileMode,
  parseTileZoom,
  MAX_PLACES_QUERY_LENGTH,
  MAX_PLACES_TEXT_QUERY_LENGTH,
} from "./server/apiValidation";

function readRequestBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function tomtomProxy(): Plugin {
  return {
    name: "tomtom-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";

        if (url === "/api/places" && req.method === "POST") {
          const placesLimit = applyRateLimit({ headers: req.headers }, "places");
          for (const [name, value] of Object.entries(rateLimitHeaders(placesLimit))) {
            res.setHeader(name, value);
          }
          if (!placesLimit.allowed) {
            res.statusCode = 429;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Too many requests. Please try again shortly." }));
            return;
          }

          const key = process.env.GOOGLE_PLACES_API_KEY;
          if (!key) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                "[places-proxy] GOOGLE_PLACES_API_KEY loaded: false — save key in .env.local and restart dev server"
              );
            }
            res.statusCode = 503;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: "Search temporarily unavailable",
                code: "PLACES_UNAVAILABLE",
              })
            );
            return;
          }

          try {
            const raw = await readRequestBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const action = parsePlacesAction(body?.action);
            if (!action) {
              res.statusCode = 400;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "Unknown or missing action" }));
              return;
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
                res.statusCode = 400;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: "Invalid autocomplete parameters" }));
                return;
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
                    languageCode: "en",
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
              if (process.env.NODE_ENV !== "production" && !upstream.ok) {
                try {
                  const err = JSON.parse(text);
                  console.warn("[places-proxy] autocomplete Google error:", {
                    httpStatus: upstream.status,
                    message: err?.error?.message ?? err?.error ?? null,
                    envKeyLoaded: true,
                  });
                } catch {
                  console.warn("[places-proxy] autocomplete Google error:", {
                    httpStatus: upstream.status,
                    envKeyLoaded: true,
                  });
                }
              }
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(text);
              return;
            }

            if (action === "searchText") {
              const textQuery = parsePlacesQuery(body.textQuery, MAX_PLACES_TEXT_QUERY_LENGTH);
              const lat = parseLatitude(body.lat);
              const lng = parseLongitude(body.lng);
              if (!textQuery || lat == null || lng == null) {
                res.statusCode = 400;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: "Invalid searchText parameters" }));
                return;
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
                    languageCode: "en",
                    regionCode: "id",
                    maxResultCount: parseMaxResultCount(body.maxResultCount),
                    rankPreference: body.rankPreference === "RELEVANCE" ? "RELEVANCE" : "DISTANCE",
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
              return;
            }

            if (action === "details") {
              const parsedPlaceId = parsePlaceId(body.placeId);
              if (!parsedPlaceId) {
                res.statusCode = 400;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: "Invalid or missing placeId" }));
                return;
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
              return;
            }

            res.statusCode = 400;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Unknown action" }));
          } catch (e: unknown) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: safeErrorMessage(e, "Server error") }));
          }
          return;
        }

        // Match query-string format used by MapScreen (same as Vercel api route)
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
            return;
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
              return;
            }

            const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/${mode}/${zoom}/${tileX}/${tileY}.png?key=${encodeURIComponent(key)}`;

            try {
              const r = await fetch(upstream);
              const buf = Buffer.from(await r.arrayBuffer());
              res.statusCode = r.status;
              res.setHeader("content-type", r.ok ? "image/png" : "text/plain; charset=utf-8");
              if (!r.ok) {
                res.end(safeUpstreamError(r.status));
                return;
              }
              res.end(buf);
            } catch (e: unknown) {
              res.statusCode = 500;
              res.setHeader("content-type", "text/plain; charset=utf-8");
              res.end(String(e instanceof Error ? e.message : e));
            }
            return;
          }
        }

        const m = url.match(
          /^\/api\/tomtom\/flow\/(relative|absolute)\/(\d+)\/(\d+)\/(\d+)\.png$/
        );
        if (!m) {
          // TomTom Routing API proxy (same TOMTOM_API_KEY as traffic tiles)
          const routeMatch = url.match(/^\/api\/tomtom-route\?(.+)$/);
          if (routeMatch) {
            const routeLimit = applyRateLimit({ headers: req.headers }, "routing");
            for (const [name, value] of Object.entries(rateLimitHeaders(routeLimit))) {
              res.setHeader(name, value);
            }
            if (!routeLimit.allowed) {
              res.statusCode = 429;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "Too many route requests. Please try again shortly." }));
              return;
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
                res.statusCode = 200;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(
                  JSON.stringify({
                    routes: result.routes,
                    meta: { provider: result.provider },
                  })
                );
              } catch (e: unknown) {
                logRouteDiagnostics(params, null, e);
                res.statusCode = 502;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: safeErrorMessage(e, "Routing failed") }));
              }
              return;
            }

            res.statusCode = 400;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Invalid origin or destination coordinates" }));
            return;
          }

          return next();
        }

        const style = parseTileMode(m[1]);
        const zoom = parseTileZoom(m[2]);
        const tileX = zoom != null ? parseTileIndex(m[3], zoom) : null;
        const tileY = zoom != null ? parseTileIndex(m[4], zoom) : null;

        const key = process.env.TOMTOM_API_KEY;
        if (!key) {
          res.statusCode = 500;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Traffic overlay unavailable");
          return;
        }

        if (!style || zoom == null || tileX == null || tileY == null) {
          res.statusCode = 400;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Invalid tile coordinates");
          return;
        }

        const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${zoom}/${tileX}/${tileY}.png?key=${encodeURIComponent(
          key
        )}`;

        try {
          const r = await fetch(upstream);
          const buf = Buffer.from(await r.arrayBuffer());

          res.statusCode = r.status;
          res.setHeader("content-type", "image/png");
          // 403やエラー時はテキストも返せるように
          if (!r.ok) {
            res.setHeader("content-type", "application/json; charset=utf-8");
          }
          res.end(buf);
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end(String(e?.message ?? e));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // ✅ Viteのdev server(=Node)側で process.env を使えるようにする
  process.env = { ...process.env, ...env };

  if (mode === "development") {
    console.info(
      "[places-proxy] GOOGLE_PLACES_API_KEY loaded:",
      Boolean(process.env.GOOGLE_PLACES_API_KEY)
    );
  }

  return {
    plugins: [react(), tomtomProxy()],
  };
});
