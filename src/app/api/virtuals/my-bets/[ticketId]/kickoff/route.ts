import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { kickOffVirtualTicket } from "../../../../../../../server/virtuals/ticket-sessions";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const ticketId = new URL(req.url).pathname.split("/").at(-2) ?? "";

  return json(await kickOffVirtualTicket(user.id, ticketId));
});