import { db } from "./src/lib/server/db";

async function main() {
  const rounds = await db.virtualRound.findMany({
    orderBy: { number: "desc" },
    take: 3,
    select: { number: true, status: true },
  });

  const fixtures = await db.fixture.findMany({
    where: {
      source: "virtual",
      externalId: { startsWith: "r10-" },
    },
    select: {
      externalId: true,
      status: true, createdAt: true, updatedAt: true,
      _count: { select: { legs: true, jackpotMatches: true } },
    },
  });

  console.log(JSON.stringify({ rounds, fixtures }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());


