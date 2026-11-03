import "dotenv/config";
import { fetchWithProviderFallback } from "./providerManager";

async function main() {
  const result = await fetchWithProviderFallback([
    {
      provider: "sportmonks",
      endpoint: "odds/pre-match/fixtures/19722767",
    },
  ]);

  if (!result || result.stale) {
    console.log("No fresh response. No bookmaker selection made.");
    process.exitCode = 1;
    return;
  }

  const payload = result.data as { data?: unknown };
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const byBookmaker = new Map<number, Map<string, {
    price: number;
    stopped: boolean;
    updatedAt: string;
  }>>();

  for (const item of rows) {
    if (!item || typeof item !== "object") continue;

    const odd = item as Record<string, unknown>;
    if (
      String(odd.market_description ?? "").toLowerCase() !== "fulltime result"
    ) continue;

    const bookmakerId = Number(odd.bookmaker_id);
    const selection = String(odd.label ?? "").toLowerCase();
    const price = Number(odd.value);

    if (
      !Number.isFinite(bookmakerId) ||
      !["home", "draw", "away"].includes(selection) ||
      !Number.isFinite(price) ||
      price <= 1
    ) continue;

    if (!byBookmaker.has(bookmakerId)) {
      byBookmaker.set(bookmakerId, new Map());
    }

    const outcomes = byBookmaker.get(bookmakerId)!;
    const candidate = {
      price,
      stopped: odd.stopped === true,
      updatedAt: String(odd.latest_bookmaker_update ?? ""),
    };
    const existing = outcomes.get(selection);

    if (
      !existing ||
      (Date.parse(candidate.updatedAt) || 0) >
        (Date.parse(existing.updatedAt) || 0)
    ) {
      outcomes.set(selection, candidate);
    }
  }

  const report = [...byBookmaker.entries()].map(([bookmakerId, outcomes]) => {
    const home = outcomes.get("home");
    const draw = outcomes.get("draw");
    const away = outcomes.get("away");
    const complete = Boolean(home && draw && away);
    const allActive = complete &&
      !home!.stopped && !draw!.stopped && !away!.stopped;

    return {
      bookmaker_id: bookmakerId,
      complete_1x2: complete,
      all_three_active: allActive,
      home: home?.price ?? null,
      draw: draw?.price ?? null,
      away: away?.price ?? null,
      latest_update: [home?.updatedAt, draw?.updatedAt, away?.updatedAt]
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
    };
  }).sort((a, b) =>
    Number(b.all_three_active) - Number(a.all_three_active) ||
    Number(b.complete_1x2) - Number(a.complete_1x2)
  );

  console.log("Fresh provider response:", !result.stale);
  console.log("Bookmakers with match-winner data:", report.length);
  console.table(report);
}

main().catch((error) => {
  console.error("Test failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
