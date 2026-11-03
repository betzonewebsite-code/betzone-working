import { db } from "@/lib/server/db";
import { isValidCodeShape, normalizeCode } from "@/lib/server/bookingCode";
import { handler, HttpError, json } from "@/lib/server/http";

export const GET = handler(async (req) => {
  const code = normalizeCode(new URL(req.url).pathname.split("/").pop() ?? "");
  if (!isValidCodeShape(code)) throw new HttpError(400, "Invalid code format.");
  const rec = await db.bookingCode.findUnique({ where: { code } });
  if (!rec || rec.expiresAt < new Date()) throw new HttpError(404, "Code not found or expired.");
  const ids = (rec.legs as { oddsId: string }[]).map((l) => l.oddsId);
  const rows = await db.marketOdds.findMany({ where: { id: { in: ids } }, include: { market: { include: { fixture: true } } } });
  const legs = ids.map((id) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return { oddsId: id, status: "unavailable" as const };
    const f = r.market.fixture;
    const open = (f.status === "LIVE" || f.status === "HALFTIME" || (f.status === "SCHEDULED" && f.kickoffAt > new Date())) && f.bettingOpen && r.market.status === "OPEN" && r.status === "OPEN";
    const odds = Number(r.odds);
    return {
      key: `${f.id}:${r.market.id}:${r.key}`, oddsId: r.id, fixtureId: f.id, marketId: r.marketId, selectionId: r.key,
      match: `${f.homeTeam} v ${f.awayTeam}`, marketName: r.market.name, pick: r.label, pickedOdds: odds, odds,
      live: f.status === "LIVE" || f.status === "HALFTIME", suspended: !open, status: open ? ("ok" as const) : ("suspended" as const),
    };
  });
  return json({ code, legs });
});
