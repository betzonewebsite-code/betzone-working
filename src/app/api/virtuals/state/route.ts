import { env } from "@/lib/server/env";
import { handler, json } from "@/lib/server/http";
import { redisReady } from "@/lib/server/redis";
import { virtualState } from "@/lib/server/virtualState";

export const GET = handler(async () => {
  if (!env.VIRTUALS_ENABLED) return json({ enabled: false });
  try { await (await redisReady()).set("virt:active", "1", "EX", 300); } catch { /* the engine just will not start new rounds */ }   // tells the engine someone is watching
  return json(await virtualState());
});
