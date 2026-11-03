import { body, handler, json } from "@/lib/server/http";
import { D } from "@/lib/server/money";
import { depositSchema } from "@/lib/server/betting/schemas";
import { startDeposit } from "@/lib/server/payments/deposit";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`dep-${user.id}`, 10, 3600);
  const { amount } = await body(req, depositSchema);
  return json(await startDeposit(user.id, D(amount)), 201);
});
