import "dotenv/config";
import { fetchSportmonksSnapshot } from "./sportmonksAdapter";

async function main() {
  const snapshot = await fetchSportmonksSnapshot();

  if (!snapshot) {
    console.log("No fresh snapshot available.");
    process.exitCode = 1;
    return;
  }

  const now = Date.now();
  const report = snapshot.fixtures.map((fixture) => {
    const byBookmaker = new Map<number, Map<string, boolean>>();

    for (const odd of snapshot.odds) {
      const fixtureId = String(odd.fixture_id ?? "");
      if (fixtureId !== String(fixture.id)) continue;
      if (String(odd.market_description ?? "").toLowerCase() !== "fulltime result") continue;

      const bookmakerId = Number(odd.bookmaker_id);
      const label = String(odd.label ?? "").toLowerCase();
      const price = Number(odd.value);
      const updatedAt = Date.parse(String(odd.latest_bookmaker_update ?? ""));

      if (!Number.isFinite(bookmakerId) || !["home", "draw", "away"].includes(label)) continue;
      if (!Number.isFinite(price) || price <= 1 || odd.stopped === true) continue;
      if (!Number.isFinite(updatedAt) || now - updatedAt > 15 * 60 * 1000) continue;

      if (!byBookmaker.has(bookmakerId)) byBookmaker.set(bookmakerId, new Map());
      byBookmaker.get(bookmakerId)!.set(label, true);
    }

    const complete = [...byBookmaker.values()].some(
      (selections) => ["home", "draw", "away"].every((label) => selections.has(label)),
    );

    return {
      fixture: fixture.name,
      kickoff: fixture.starting_at,
      complete_active_1x2: complete,
    };
  });

  console.log("Fixtures:", report.length);
  console.log("Fixtures with complete active 1X2:", report.filter((r) => r.complete_active_1x2).length);
  console.table(report.slice(0, 15));
}

main().catch((error) => {
  console.error("Quality check failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
