import Redis from "ioredis";
import { env } from "./env";

const g = globalThis as unknown as { __redis?: Redis };
export const redis =
  g.__redis ?? new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
redis.on("error", () => { /* handled where used; avoids unhandled error events */ });
if (env.NODE_ENV !== "production") g.__redis = redis;

export async function redisReady() {
  if (redis.status === "wait") await redis.connect();
  return redis;
}
