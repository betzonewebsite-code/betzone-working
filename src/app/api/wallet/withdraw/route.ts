import { body, handler, json } from "@/lib/server/http";
import { D } from "@/lib/server/money";
import { withdrawSchema } from "@/lib/server/betting/schemas";
import { startWithdrawal } from "@/lib/server/payments/withdraw";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`wd-${user.id}`, 10, 3600);
  const i = await body(req, withdrawSchema);
  return json(await startWithdrawal(user.id, D(i.amount), i.network, i.pin), 201);
});
