import "server-only";
import { HttpError } from "./server";

/**
 * Small in-memory rate limiter. Each Vercel instance keeps its own counters,
 * so this is a speed bump against scripted abuse, not a hard guarantee. Pair
 * it with a Vercel Firewall rate-limit rule (see README) for a global limit.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, message: string) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    throw new HttpError(429, message);
  }
  hits.push(now);
  buckets.set(key, hits);
  // Keep memory bounded if many IPs show up.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
}

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
