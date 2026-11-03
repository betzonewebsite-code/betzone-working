import { body, handler, json } from "@/lib/server/http";
import { pinSchema } from "@/lib/server/betting/schemas";
import { setPin } from "@/lib/server/payments/withdraw";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`setpin-${user.id}`, 5, 900);
  const i = await body(req, pinSchema);
  await setPin(user.id, i.password, i.pin);
  return json({ ok: true });
});
