import {
  applyRateLimit,
  rateLimitHeaders,
  safeErrorMessage,
} from "../server/apiSecurity.js";
import { getLiveTrafficTomTomSnapshot } from "../server/liveTrafficReportsCache.js";

export default async function handler(
  req: {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    headers?: Record<string, string | string[] | undefined>;
  },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (name: string, value: string) => void;
  }
) {
  const limit = applyRateLimit(req, "trafficSegment");
  for (const [name, value] of Object.entries(rateLimitHeaders(limit))) {
    res.setHeader(name, value);
  }
  if (!limit.allowed) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const langRaw = req.query?.lang;
    const language = typeof langRaw === "string" ? langRaw : "en";
    const snapshot = await getLiveTrafficTomTomSnapshot(language);

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=60");
    res.status(200).json({
      status: snapshot.status,
      fetchedAt: snapshot.fetchedAt,
      providerTrafficModelId: snapshot.providerTrafficModelId,
      cacheAgeMs: snapshot.cacheAgeMs,
      nextRefreshMs: snapshot.nextRefreshMs,
      incidents: snapshot.incidents,
      messageKey:
        snapshot.status === "unavailable"
          ? "liveTraffic.fetchUnavailable"
          : snapshot.status === "stale"
            ? "liveTraffic.fetchStale"
            : null,
    });
  } catch (e: unknown) {
    res.status(500).json({
      status: "unavailable",
      fetchedAt: null,
      providerTrafficModelId: null,
      cacheAgeMs: null,
      nextRefreshMs: 240000,
      incidents: [],
      messageKey: "liveTraffic.fetchUnavailable",
      error: safeErrorMessage(e, "Server error"),
    });
  }
}
