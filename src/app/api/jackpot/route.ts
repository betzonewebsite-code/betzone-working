import { db } from "@/lib/server/db";
import { handler, json } from "@/lib/server/http";
import { roundDto, roundInclude } from "@/lib/server/jackpot";

export const GET = handler(async () => {
  const round = await db.jackpotRound.findFirst({ where: { status: "OPEN", closesAt: { gt: new Date() } }, orderBy: { closesAt: "asc" }, include: roundInclude });
  return json({ round: round ? roundDto(round) : null });
});
