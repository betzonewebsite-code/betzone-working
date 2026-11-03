import { db } from "@/lib/server/db";
import { body, handler, HttpError, json } from "@/lib/server/http";
import { autoSchema } from "@/lib/server/betting/schemas";
import { D } from "@/lib/server/money";
import { requireUser } from "@/lib/server/session";

export const PUT = handler(async (req) => {
  const user = await requireUser(req);
  const id = new URL(req.url).pathname.split("/").at(-2) ?? "";
  const { target } = await body(req, autoSchema);
  const r = await db.betTicket.updateMany({ where: { id, userId: user.id, status: "OPEN" }, data: { autoCashoutTarget: target === null ? null : D(target) } });
  if (!r.count) throw new HttpError(404, "Open bet not found.");
  return json({ ok: true });
});
