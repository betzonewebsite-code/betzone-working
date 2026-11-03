import { HttpError } from "./http";
import { redisReady } from "./redis";
import { env } from "./env";

/** Fixed-window counter in Redis. In production a Redis outage blocks the request; in development it lets it through. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const k = `rl:${key}`;
  try {
    const client = await redisReady();
    await client.set(k, 0, "EX", windowSec, "NX");
    const n = await client.incr(k);
    if (n > limit) {
      const ttl = await client.ttl(k);
      throw new HttpError(429, `Too many attempts. Try again in ${Math.max(ttl, 1)}s.`, "RATE_LIMITED");
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (env.NODE_ENV === "production") throw new HttpError(503, "Service busy. Please try again shortly.");
    console.warn("[ratelimit] Redis unavailable, skipping limits in development");
  }
}
