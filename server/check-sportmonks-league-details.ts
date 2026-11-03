import "dotenv/config";
import { fetchWithProviderFallback } from "./providerManager";

async function main() {
  for (const id of [271, 501]) {
    const result = await fetchWithProviderFallback([{
      provider: "sportmonks",
      endpoint: `leagues/${id}`,
      params: { include: "country;currentSeason" }
    }]);

    if (!result || result.stale) {
      console.log(`League ${id}: no fresh response`);
      continue;
    }

    const payload = result.data as { data?: Record<string, any> };
    const league = payload.data;

    console.log({
      id,
      name: league?.name,
      country: league?.country?.name ?? "Not returned",
      currentSeason: league?.currentseason?.id
        ?? league?.currentSeason?.id
        ?? "Not returned"
    });
  }
}

main().catch(e => {
  console.error("Lookup failed:", e instanceof Error ? e.message : "Unknown error");
  process.exitCode = 1;
});
