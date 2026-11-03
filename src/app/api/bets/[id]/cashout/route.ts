import { body, handler, json } from "@/lib/server/http";
import { executeCashout } from "@/lib/server/betting/cashout";
import { cashoutSchema } from "@/lib/server/betting/schemas";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const id = new URL(req.url).pathname.split("/").at(-2) ?? "";
  const i = await body(req, cashoutSchema);
  return json(await executeCashout(user.id, id, i.fraction, i.expectedAmount, i.idempotencyKey));
});
