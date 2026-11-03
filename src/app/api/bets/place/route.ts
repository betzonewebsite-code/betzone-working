import { body, getIp, handler, json } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { placeBets } from "@/lib/server/betting/place";
import { placeSchema } from "@/lib/server/betting/schemas";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`bet-${user.id}`, 30, 60);
  await rateLimit(`bet-ip-${getIp(req)}`, 120, 60);
  const input = await body(req, placeSchema);
  return json(await placeBets(user.id, input), 201);
});
