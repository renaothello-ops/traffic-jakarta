import {
  checkRateLimit,
  checkRateLimits,
  getClientIp,
  PLACES_RATE_LIMIT,
  ROUTING_RATE_LIMIT,
  TRAFFIC_TILE_BURST_LIMIT,
  TRAFFIC_TILE_RATE_LIMIT,
  type RateLimitResult,
} from "./rateLimit.js";

type HeaderBag = Record<string, string | string[] | undefined>;

export function applyRateLimit(
  req: { headers?: HeaderBag },
  endpoint:
    | "places"
    | "routing"
    | "trafficTile"
    | "trafficSegment"
    | "analyzeReport"
): RateLimitResult {
  const ip = getClientIp(req.headers);
  const key = `${endpoint}:${ip}`;

  if (endpoint === "places") {
    return checkRateLimit(key, PLACES_RATE_LIMIT);
  }
  if (endpoint === "routing") {
    return checkRateLimit(key, ROUTING_RATE_LIMIT);
  }
  if (endpoint === "trafficSegment" || endpoint === "analyzeReport") {
    return checkRateLimit(key, ROUTING_RATE_LIMIT);
  }
  return checkRateLimits(key, [TRAFFIC_TILE_BURST_LIMIT, TRAFFIC_TILE_RATE_LIMIT]);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {};
  if (result.remaining != null) {
    headers["X-RateLimit-Remaining"] = String(result.remaining);
  }
  if (result.retryAfterSeconds != null) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return headers;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function safeErrorMessage(error: unknown, fallback = "Server error"): string {
  if (!isProduction()) {
    return error instanceof Error ? error.message : fallback;
  }
  return fallback;
}

export function safeUpstreamError(status: number): string {
  if (status === 401 || status === 403) return "Upstream authorization failed";
  if (status === 429) return "Upstream rate limit exceeded";
  if (status >= 500) return "Upstream service unavailable";
  return "Upstream request failed";
}

export { PLACES_RATE_LIMIT, ROUTING_RATE_LIMIT, TRAFFIC_TILE_RATE_LIMIT };
