/**
 * Per-instance rate limiting for Vercel serverless / local dev.
 *
 * NOTE: This store is in-memory and NOT reliable across serverless instances.
 * For production-grade distributed limiting, plug in Vercel KV, Upstash Redis,
 * or similar via `checkDistributedRateLimit` when available.
 */

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now()
): RateLimitResult {
  const bucketKey = key;
  let bucket = buckets.get(bucketKey);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(bucketKey, bucket);
  }

  if (bucket.count >= config.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - bucket.count),
  };
}

/** Apply multiple limit windows (e.g. sustained + burst) — all must pass. */
export function checkRateLimits(
  key: string,
  configs: RateLimitConfig[],
  now = Date.now()
): RateLimitResult {
  for (const config of configs) {
    const result = checkRateLimit(`${key}:${config.windowMs}:${config.maxRequests}`, config, now);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

export function getClientIp(
  headers: Record<string, string | string[] | undefined> | undefined
): string {
  if (!headers) return "unknown";

  const forwarded = headers["x-forwarded-for"] ?? headers["X-Forwarded-For"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0]?.trim() || "unknown";
  }

  const realIp = headers["x-real-ip"] ?? headers["X-Real-IP"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  return "unknown";
}

/** Conservative defaults — tuned for normal map/navigation usage. */
export const PLACES_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 90,
};

export const ROUTING_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 40,
};

/** MapLibre loads many tiles per viewport; allow burst + sustained. */
export const TRAFFIC_TILE_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 720,
};

export const TRAFFIC_TILE_BURST_LIMIT: RateLimitConfig = {
  windowMs: 10_000,
  maxRequests: 180,
};

export const EXTERNAL_RATE_LIMIT_STORE_REQUIRED = true;
