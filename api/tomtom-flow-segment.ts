import {
  applyRateLimit,
  rateLimitHeaders,
  safeErrorMessage,
} from "../server/apiSecurity";
import { fetchTomTomFlowSegment } from "../server/tomtomFlowSegment";

export default async function handler(
  req: { method?: string; query?: Record<string, string>; headers?: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => {
      json: (body: unknown) => void;
      send: (body: string) => void;
    };
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

  if (req.method !== "GET" && req.method !== undefined) {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const q = req.query ?? {};
    const payload = await fetchTomTomFlowSegment(q.lat, q.lng);
    if (!payload) {
      res.status(503).json({ error: "Traffic segment unavailable" });
      return;
    }
    res.setHeader("Cache-Control", "private, max-age=30");
    res.status(200).json(payload);
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e, "Server error") });
  }
}
