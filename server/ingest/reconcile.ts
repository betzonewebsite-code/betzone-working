import type { Prisma } from "@prisma/client";
import { db } from "../../src/lib/server/db";
import { LEAGUES } from "./leagues";
import { sameMatch } from "./normalize";
import type { Provider } from "./types";

const GIVE_UP_MS = 6 * 3_600_000;

/**
 * Double-checks finished results against a second provider. Settlement (Phase 6) pays out only when
 * result.agreed is true, or null for a single-source setup. false means "disagreement: a human must review".
 */
export async function reconcile(secondary: Provider | null) {
  const since = new Date(Date.now() - 3 * 86_400_000);
  const finished = await db.fixture.findMany({ where: { status: "FINISHED", updatedAt: { gte: since } }, include: { league: true } });
  const pending = finished.filter((f) => (f.result as { agreed?: boolean | null } | null)?.agreed === undefined);
  if (!pending.length) return { checked: 0 };

  const set = async (id: string, patch: Record<string, unknown>) => {
    const f = finished.find((x) => x.id === id)!;
    await db.fixture.update({ where: { id }, data: { result: { ...((f.result as object) ?? {}), ...patch, checkedAt: new Date().toISOString() } as Prisma.InputJsonValue } });
  };
  if (!secondary) { for (const f of pending) await set(f.id, { agreed: null, note: "single source" }); return { checked: pending.length }; }

  const keys = new Set(pending.map((f) => f.league.externalId));
  const finals = await secondary.fetchFinals(LEAGUES.filter((l) => keys.has(l.key)));
  let agreed = 0, disputed = 0;
  for (const f of pending) {
    const mine = { home: f.homeTeam, away: f.awayTeam, kickoff: f.kickoffAt };
    const other = finals.find((x) => x.leagueKey === f.league.externalId && sameMatch(mine, x));
    if (!other) {
      if (Date.now() - f.updatedAt.getTime() > GIVE_UP_MS) await set(f.id, { agreed: null, note: `no match in ${secondary.name} after 6h` });
      continue;
    }
    const ok = other.score[0] === f.homeScore && other.score[1] === f.awayScore;
    await set(f.id, { agreed: ok, secondary: { source: other.source, score: other.score } });
    ok ? agreed++ : disputed++;
    if (!ok) console.error(`[reconcile] DISPUTE ${f.homeTeam} v ${f.awayTeam}: ${f.homeScore}-${f.awayScore} vs ${other.score.join("-")} (${other.source}). Do not settle until reviewed.`);
  }
  console.log(`[reconcile] ${agreed} agreed, ${disputed} disputed, ${pending.length - agreed - disputed} waiting`);
  return { checked: pending.length, agreed, disputed };
}
