import "dotenv/config";
import { fetchWithProviderFallback } from "./providerManager";

type Row = Record<string, unknown>;

export type SportmonksPayload = {
  provider: "sportmonks";
  fetchedAt: number;
  fixtures: Row[];
  odds: Row[];
};

function extractRows(value: unknown): Row[] | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  if (!Array.isArray(root.data)) return null;

  return root.data.filter(
    (row): row is Row =>
      row !== null && typeof row === "object" && !Array.isArray(row),
  );
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isUpcomingFixture(row: Row, now: number): boolean {
  const kickoff = Date.parse(String(row.starting_at ?? ""));
  return Number.isFinite(kickoff) && kickoff > now;
}

export async function fetchSportmonksSnapshot(): Promise<SportmonksPayload | null> {
  const now = Date.now();
  const start = dateOnly(new Date(now));
  const end = dateOnly(new Date(now + 14 * 24 * 60 * 60 * 1000));

  const fixtureResult = await fetchWithProviderFallback([
    {
      provider: "sportmonks",
      endpoint: `fixtures/between/${start}/${end}`,
      params: { per_page: "50" },
    },
  ]);

  if (!fixtureResult || fixtureResult.stale) return null;

  const allFixtures = extractRows(fixtureResult.data);
  if (!allFixtures) {
    console.error("Sportmonks returned an unexpected fixture response.");
    return null;
  }

  const fixtures = allFixtures.filter((fixture) =>
    isUpcomingFixture(fixture, now),
  );

  const eligibleFixtures = fixtures.filter(
    (fixture) => fixture.has_odds === true && Number.isFinite(Number(fixture.id)),
  );

  const odds: Row[] = [];
  let latestFetchedAt = fixtureResult.fetchedAt;
  const concurrency = 4;

  for (let i = 0; i < eligibleFixtures.length; i += concurrency) {
    const batch = eligibleFixtures.slice(i, i + concurrency);

    const results = await Promise.all(
      batch.map(async (fixture) => {
        const result = await fetchWithProviderFallback([
          {
            provider: "sportmonks",
            endpoint: `odds/pre-match/fixtures/${String(fixture.id)}`,
            params: { per_page: "50" },
          },
        ]);

        if (!result || result.stale) return null;

        const rows = extractRows(result.data);
        if (!rows) return null;

        return { fetchedAt: result.fetchedAt, rows };
      }),
    );

    for (const result of results) {
      if (!result) continue;

      latestFetchedAt = Math.min(latestFetchedAt, result.fetchedAt);

      for (const odd of result.rows) {
        const price = Number(odd.value);
        const updatedAt = Date.parse(String(odd.latest_bookmaker_update ?? ""));

        if (
          !Number.isFinite(price) ||
          price <= 1 ||
          odd.stopped === true ||
          !Number.isFinite(updatedAt) ||
          now - updatedAt > 15 * 60 * 1000
        ) {
          continue;
        }

        odds.push(odd);
      }
    }
  }

  return {
    provider: "sportmonks",
    fetchedAt: latestFetchedAt,
    fixtures,
    odds,
  };
}
