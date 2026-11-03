// npm run jackpot:create -- --fee 5 --count 10 --title "Weekend Jackpot"
// Picks the next upcoming matches (popular leagues first) and opens a jackpot round on them.
import { db } from "../../src/lib/server/db";
import { D } from "../../src/lib/server/money";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };

async function main() {
  const fee = Number(arg("fee", "5")), count = Number(arg("count", "10")), title = arg("title", "Zone Jackpot");
  if (!(fee > 0) || count < 5 || count > 15) throw new Error("--fee must be positive and --count between 5 and 15");
  if (await db.jackpotRound.findFirst({ where: { status: "OPEN" } })) throw new Error("A jackpot round is already open.");

  const now = new Date();
  const fixtures = await db.fixture.findMany({
    where: { source: { not: "virtual" }, status: "SCHEDULED", sport: "SOCCER", kickoffAt: { gt: new Date(now.getTime() + 2 * 3_600_000), lt: new Date(now.getTime() + 7 * 86_400_000) }, markets: { some: { type: "ONE_X_TWO" } } },
    include: { league: true }, orderBy: [{ league: { sortOrder: "asc" } }, { kickoffAt: "asc" }], take: 80,
  });
  const chosen = fixtures.slice(0, count).sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
  if (chosen.length < count) throw new Error(`Only ${chosen.length} suitable matches found. Run the sports ingest first, or lower --count.`);

  const carry = await db.jackpotRound.findFirst({ where: { status: "SETTLED", carryOver: { gt: 0 }, carryClaimed: false }, orderBy: { settledAt: "desc" } });
  const round = await db.$transaction(async (tx) => {
    if (carry) await tx.jackpotRound.update({ where: { id: carry.id }, data: { carryClaimed: true } });
    return tx.jackpotRound.create({
      data: {
        title, entryFee: D(fee), seed: carry ? carry.carryOver : D(0), closesAt: new Date(chosen[0].kickoffAt.getTime() - 5 * 60_000),
        matches: { create: chosen.map((f, i) => ({ fixtureId: f.id, position: i + 1 })) },
      },
    });
  });
  console.log(`Opened "${round.title}": ${chosen.length} matches, entry ${fee}, closes ${round.closesAt.toISOString()}${carry ? `, seeded with ${carry.carryOver} carried over` : ""}`);
  chosen.forEach((f, i) => console.log(`  ${i + 1}. ${f.homeTeam} v ${f.awayTeam} (${f.league.name})`));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
