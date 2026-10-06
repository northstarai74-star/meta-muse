import { db } from "./db";

type Bucket = { count: number; resetAt: number };
type Result = { ok: boolean; retryAfter: number };

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window, in-memory limiter. Only correct for a single long-lived process, so it is used
 * as a fallback when the database is unreachable (and in unit tests).
 */
export function memoryRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): Result {
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  return b.count > limit ? { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) } : { ok: true, retryAfter: 0 };
}

/**
 * Fixed-window limiter stored in Postgres, so every serverless instance (Vercel) shares the same counts.
 * One atomic upsert per call: a new or expired window restarts at 1, otherwise the count is incremented.
 */
export async function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<Result> {
  const at = new Date(now);
  const reset = new Date(now + windowMs);
  try {
    const [row] = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${reset})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" <= ${at} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${at} THEN ${reset} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    // Occasionally sweep expired windows so the table stays small.
    if (Math.random() < 0.02) await db.rateLimit.deleteMany({ where: { resetAt: { lt: at } } });
    return row.count > limit
      ? { ok: false, retryAfter: Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1000)) }
      : { ok: true, retryAfter: 0 };
  } catch (err) {
    console.error("[rate-limit] database unavailable, using in-memory limiter", err);
    return memoryRateLimit(key, limit, windowMs, now);
  }
}

export async function resetRateLimit(key: string) {
  buckets.delete(key);
  await db.rateLimit.deleteMany({ where: { key } }).catch(() => {});
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
