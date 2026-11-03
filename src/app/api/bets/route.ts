import { z } from "zod";
import { db } from "@/lib/server/db";
import { cashoutInclude } from "@/lib/server/betting/cashout";
import { ticketDto } from "@/lib/server/betting/dto";
import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const status = z.enum(["open", "settled"]).catch("open").parse(new URL(req.url).searchParams.get("status"));

  if (status === "open") {
    const tickets = await db.betTicket.findMany({
      where: { userId: user.id, isVirtual: false, status: "OPEN" },
      include: cashoutInclude,
      orderBy: { placedAt: "desc" },
      take: 50,
    });
    return json({ tickets: tickets.map(ticketDto) });
  }

  const tickets = await db.betTicket.findMany({
    where: { userId: user.id, isVirtual: false, status: { not: "OPEN" } },
    include: { legs: true },
    orderBy: { placedAt: "desc" },
    take: 50,
  });

  return json({ tickets: tickets.map(ticketDto) });
});
