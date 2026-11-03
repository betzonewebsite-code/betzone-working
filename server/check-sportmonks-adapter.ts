import "dotenv/config";
import { fetchSportmonksSnapshot } from "./sportmonksAdapter";

async function main() {
  const snapshot = await fetchSportmonksSnapshot();

  if (!snapshot) {
    console.log("No fresh Sportmonks snapshot returned.");
    process.exitCode = 1;
    return;
  }

  console.log("Provider:", snapshot.provider);
  console.log("Fetched:", new Date(snapshot.fetchedAt).toISOString());
  console.log("Upcoming fixtures:", snapshot.fixtures.length);
  console.log("Fresh active odds:", snapshot.odds.length);

  console.table(
    snapshot.fixtures.slice(0, 10).map((f) => ({
      id: f.id,
      match: f.name,
      kickoff: f.starting_at,
      has_odds: f.has_odds,
      odds_found: snapshot.odds.some(
        (o) => String(o.fixture_id ?? "") === String(f.id),
      ),
    })),
  );
}

main().catch((error) => {
  console.error("Adapter test failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
