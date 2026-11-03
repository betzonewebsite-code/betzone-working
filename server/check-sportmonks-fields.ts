import "dotenv/config";
import { fetchSportmonksSnapshot } from "./sportmonksAdapter";

async function main() {
  const snapshot = await fetchSportmonksSnapshot();

  if (!snapshot) {
    console.log("No fresh snapshot returned.");
    process.exitCode = 1;
    return;
  }

  console.log("\n--- FIXTURE FIELD NAMES ---");
  const fixture = snapshot.fixtures[0];
  console.log(Object.keys(fixture ?? {}));

  console.log("\n--- FIXTURE SAMPLE ---");
  console.log(JSON.stringify({
    id: fixture?.id,
    name: fixture?.name,
    starting_at: fixture?.starting_at,
    league_id: fixture?.league_id,
    league: fixture?.league,
    participants: fixture?.participants,
    has_odds: fixture?.has_odds
  }, null, 2));

  console.log("\n--- ODDS FIELD NAMES ---");
  console.log(Object.keys(snapshot.odds[0] ?? {}));

  console.log("\n--- SAMPLE ODDS ---");
  console.table(snapshot.odds.slice(0, 12).map(o => ({
    fixture_id: o.fixture_id,
    market_description: o.market_description,
    bookmaker_id: o.bookmaker_id,
    label: o.label,
    value: o.value,
    latest_bookmaker_update: o.latest_bookmaker_update,
    stopped: o.stopped
  })));
}

main().catch(error => {
  console.error("Diagnostic failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
