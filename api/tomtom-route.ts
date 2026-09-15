import {
  calculateRouteProxy,
  logRouteDiagnostics,
} from "../server/calculateRoute";
import {
  applyRateLimit,
  rateLimitHeaders,
  safeErrorMessage,
} from "../server/apiSecurity";
import { parseRouteCoordinatePair } from "../server/apiValidation";

export default async function handler(req: { query?: Record<string, string>; headers?: Record<string, string | string[] | undefined> }, res: {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader: (name: string, value: string) => void;
}) {
  const limit = applyRateLimit(req, "routing");
  for (const [name, value] of Object.entries(rateLimitHeaders(limit))) {
    res.setHeader(name, value);
  }
  if (!limit.allowed) {
    res.status(429).json({ error: "Too many route requests. Please try again shortly." });
    return;
  }

  try {
    const q = req.query ?? {};
    const coords = parseRouteCoordinatePair(
      q.originLat,
      q.originLng,
      q.destLat,
      q.destLng
    );

    if (!coords) {
      res.status(400).json({ error: "Invalid origin or destination coordinates" });
      return;
    }

    const params = {
      originLat: String(coords.originLat),
      originLng: String(coords.originLng),
      destLat: String(coords.destLat),
      destLng: String(coords.destLng),
    };

    try {
      const result = await calculateRouteProxy(params);
      logRouteDiagnostics(params, result);

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        routes: result.routes,
        meta: { provider: result.provider },
      });
    } catch (error) {
      logRouteDiagnostics(params, null, error);
      const message = safeErrorMessage(error, "Routing failed");
      res.status(502).json({ error: message });
    }
  } catch (e: unknown) {
    const message = safeErrorMessage(e, "Server error");
    res.status(500).json({ error: message });
  }
}
