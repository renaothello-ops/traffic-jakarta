import {
  applyRateLimit,
  isProduction,
  rateLimitHeaders,
  safeErrorMessage,
  safeUpstreamError,
} from "../server/apiSecurity.js";
import {
  parseTileIndex,
  parseTileMode,
  parseTileZoom,
} from "../server/apiValidation.js";
import { tomtomApiKey } from "../server/envSecrets.js";

export default async function handler(req: { query?: Record<string, string>; headers?: Record<string, string | string[] | undefined> }, res: {
  status: (code: number) => { send: (body: string | Buffer) => void };
  setHeader: (name: string, value: string) => void;
}) {
  const limit = applyRateLimit(req, "trafficTile");
  for (const [name, value] of Object.entries(rateLimitHeaders(limit))) {
    res.setHeader(name, value);
  }
  if (!limit.allowed) {
    res.status(429).send("Too many traffic tile requests");
    return;
  }

  try {
    const { mode, z, x, y } = req.query ?? {};

    const tileMode = parseTileMode(mode);
    if (!tileMode) {
      res.status(400).send("Invalid mode");
      return;
    }

    const zoom = parseTileZoom(z);
    const tileX = zoom != null ? parseTileIndex(x, zoom) : null;
    const tileY = zoom != null ? parseTileIndex(y, zoom) : null;

    if (zoom == null || tileX == null || tileY == null) {
      res.status(400).send("Invalid z/x/y");
      return;
    }

    const key = tomtomApiKey();
    if (!key) {
      res.status(500).send("Traffic overlay unavailable");
      return;
    }

    const url = `https://api.tomtom.com/traffic/map/4/tile/flow/${tileMode}/${zoom}/${tileX}/${tileY}.png?key=${encodeURIComponent(
      key
    )}`;

    const r = await fetch(url);
    if (!r.ok) {
      if (isProduction()) {
        res.status(r.status).send(safeUpstreamError(r.status));
        return;
      }
      const text = await r.text();
      res.status(r.status).send(text.slice(0, 500));
      return;
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Cache-Control",
      "public, max-age=45, s-maxage=45, stale-while-revalidate=30"
    );
    res.status(200).send(buf);
  } catch (e: unknown) {
    res.status(500).send(safeErrorMessage(e, "Server error"));
  }
}
