import "dotenv/config";
import { fetchWithProviderFallback } from "./providerManager";

type Row = Record<string, any>;

async function main() {
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 86400000);
  const date = (d: Date) => d.toISOString().slice(0, 10);

  const result = await fetchWithProviderFallback([{
    provider: "sportmonks",
    endpoint: `fixtures/between/${date(now)}/${date(end)}`,
    params: { per_page: "50", include: "league" }
  }]);

  if (!result || result.stale) {
    console.log("No fresh Sportmonks response. No code was changed.");
    process.exitCode = 1;
    return;
  }

  const payload = result.data as { data?: Row[] };
  const fixtures = payload.data ?? [];
  const leagues = new Map<string, {
    id: string;
    name: string;
    country: string;
    fixtures: number;
  }>();

  for (const f of fixtures) {
    const league = f.league as Row | undefined;
    const id = String(f.league_id ?? league?.id ?? "unknown");
    const existing = leagues.get(id);

    leagues.set(id, {
      id,
      name: String(league?.name ?? "League name not included"),
      country: String(league?.country?.name ?? league?.country_name ?? "Unknown"),
      fixtures: (existing?.fixtures ?? 0) + 1
    });
  }

  console.log("Fixtures returned:", fixtures.length);
  console.log("Distinct leagues:", leagues.size);
  console.table([...leagues.values()]);
}

main().catch(error => {
  console.error("League diagnostic failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
