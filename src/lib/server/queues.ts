import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

type Bag = { conn: IORedis; settlement: Queue; payouts: Queue };
const g = globalThis as unknown as { __bq?: Bag };

function init(): Bag {
  const conn = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });   // BullMQ requires this
  return { conn, settlement: new Queue("settlement", { connection: conn }), payouts: new Queue("payouts", { connection: conn }) };
}
export const queues = () => (g.__bq ??= init());
export const redisConnection = () => queues().conn;

// Job ids may not contain ":" in BullMQ, so ids use "-".
export const retryOpts = { attempts: 5, backoff: { type: "exponential" as const, delay: 2000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } };
