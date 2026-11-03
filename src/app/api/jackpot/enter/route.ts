import { z } from "zod";
import { body, handler, json } from "@/lib/server/http";
import { enterJackpot } from "@/lib/server/jackpot";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`jp-${user.id}`, 20, 60);
  const i = await body(req, z.object({ roundId: z.string().min(5).max(40), picks: z.record(z.string(), z.enum(["1", "X", "2"])), idempotencyKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9-]+$/) }));
  return json(await enterJackpot(user.id, i.roundId, i.picks, i.idempotencyKey), 201);
});
