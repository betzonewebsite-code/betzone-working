import { env } from "../../src/lib/server/env";
import { redis } from "../../src/lib/server/redis";
import { LEAGUES, updateDiscoveredLeagues } from "./leagues";
import { reconcile } from "./reconcile";
import { sportmonks } from "./providers/sportmonks";
import { sportsGameOdds } from "./providers/sportsgameodds";
import { theOddsApi } from "./providers/theoddsapi";
import { enrichFixtureLogos, sweepReopen, syncOnce } from "./sync";
import { enrichMissingTeamCrests } from "./teamCrests";
import type { LeagueDef, Provider } from "./types";

const providerByName: Record<string, Provider> = {
  sportmonks,
  sportsgameodds: sportsGameOdds,
  "the-odds-api": theOddsApi,
};

const primaryOrder = [
  env.SPORTS_PRIMARY,
  env.SPORTS_SECONDARY,
  env.SPORTS_TERTIARY,
].filter((name) => name !== "none");

const uniquePrimaryOrder = [...new Set(primaryOrder)];

const configuredProviders = uniquePrimaryOrder.map((name) => {
  const provider = providerByName[name];

  if (!provider) {
    throw new Error(`Unknown sports provider configured: ${name}`);
  }

  return provider;
});

// Process in reverse priority so the primary provider writes last.
const processingOrder = [...configuredProviders].reverse();

const footballLeagues = LEAGUES.filter(
  (league) => league.sport === "SOCCER",
);

const POLL_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.SPORTS_INGEST_INTERVAL_MS) || 60_000,
);

const RECONCILE_INTERVAL_MS = 5 * 60_000;

let shuttingDown = false;
let lastReconcileAt = 0;

async function runOnce(): Promise<void> {
  console.log(
    `[ingest] Primary-to-tertiary order=${uniquePrimaryOrder.join(",")}; ` +
      `processing order=${processingOrder.map((p) => p.name).join(",")}`,
  );

  let successfulProviders = 0;
  const failures: string[] = [];

  for (const provider of processingOrder) {
    const baseLeagues =
      provider.name === "sportmonks" ? footballLeagues : LEAGUES;

    try {
      let leaguesForProvider: LeagueDef[] = baseLeagues;

      if (provider.discoverLeagues) {
        const discovered = await provider.discoverLeagues();

        if (discovered.length > 0) {
          await updateDiscoveredLeagues(discovered);

          const byKey = new Map<string, LeagueDef>();

          for (const league of [...baseLeagues, ...discovered]) {
            byKey.set(league.key, league);
          }

          leaguesForProvider = [...byKey.values()];
        }
      }

      // Fetch scheduled and upcoming fixtures.
      await syncOnce(provider, { live: false }, leaguesForProvider);

      successfulProviders++;

      console.log(
        `[ingest] ${provider.name} upcoming fixtures completed.`,
      );

      // SportsGameOdds supports league-specific live event requests.
      // Do not send global live requests because the current subscription
      // requires a leagueID or eventID.
      if (provider.name === "sportsgameodds") {
        try {
          await syncOnce(
            provider,
            { live: true },
            leaguesForProvider,
          );

          console.log(
            "[ingest] SportsGameOdds live fixtures completed.",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          failures.push(`sportsgameodds live: ${message}`);

          console.error(
            `[ingest] SportsGameOdds live update failed: ${message}`,
          );
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      failures.push(`${provider.name}: ${message}`);

      console.error(
        `[ingest] ${provider.name} failed: ${message}`,
      );
    }
  }

  // Enrich provider fixtures with matching Sportmonks team crests.
  try {
    const enriched = await enrichFixtureLogos();

    if (enriched > 0) {
      console.log(`[ingest] Added missing crests to ${enriched} fixtures.`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    failures.push(`crest enrichment: ${message}`);
    console.error(`[ingest] Crest enrichment failed: ${message}`);
  }
  // TheSportsDB crest enrichment for teams not covered by Sportmonks.
  try {
    const enrichedTeams = await enrichMissingTeamCrests();

    if (enrichedTeams > 0) {
      console.log(`[ingest] TheSportsDB added crests to ${enrichedTeams} fixtures.`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    failures.push(`TheSportsDB crest enrichment: ${message}`);
    console.error(`[ingest] TheSportsDB crest enrichment failed: ${message}`);
  }
  // Reconciliation is less frequent to avoid unnecessary provider requests.
  const now = Date.now();

  if (now - lastReconcileAt >= RECONCILE_INTERVAL_MS) {
    try {
      await reconcile(
        env.SPORTS_SECONDARY === "sportsgameodds"
          ? sportsGameOdds
          : env.SPORTS_SECONDARY === "the-odds-api"
            ? theOddsApi
            : null,
      );

      lastReconcileAt = now;

      console.log("[ingest] Result reconciliation completed.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      failures.push(`reconciliation: ${message}`);

      console.error(
        `[ingest] Reconciliation failed: ${message}`,
      );
    }
  }

  // Run reopening checks each cycle.
  try {
    await sweepReopen();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    failures.push(`sweep: ${message}`);

    console.error(
      `[ingest] Fixture reopening check failed: ${message}`,
    );
  }

  if (successfulProviders === 0) {
    throw new Error(
      `All fixture providers failed. ${failures.join(" | ")}`,
    );
  }

  if (failures.length > 0) {
    console.warn(
      `[ingest] Cycle completed with warnings: ${failures.join(" | ")}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  console.log(
    `[ingest] Runner started. Primary=${env.SPORTS_PRIMARY}; ` +
      `secondary=${env.SPORTS_SECONDARY}; ` +
      `tertiary=${env.SPORTS_TERTIARY}`,
  );

  console.log(
    `[ingest] Automatic refresh interval: ${POLL_INTERVAL_MS / 1000}s`,
  );

  if (once) {
    await runOnce();
    return;
  }

  process.on("SIGINT", () => {
    console.log("[ingest] Shutdown requested (SIGINT).");
    shuttingDown = true;
  });

  process.on("SIGTERM", () => {
    console.log("[ingest] Shutdown requested (SIGTERM).");
    shuttingDown = true;
  });

  while (!shuttingDown) {
    const startedAt = Date.now();

    try {
      await runOnce();
    } catch (error) {
      console.error("[ingest] Cycle failed:", error);
    }

    if (shuttingDown) break;

    const elapsed = Date.now() - startedAt;
    const waitMs = Math.max(0, POLL_INTERVAL_MS - elapsed);

    if (waitMs > 0) {
      console.log(
        `[ingest] Next refresh in ${Math.round(waitMs / 1000)} seconds.`,
      );

      await sleep(waitMs);
    }
  }

  console.log("[ingest] Runner stopped.");
}

main()
  .catch((error) => {
    console.error("[ingest] Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await redis.quit().catch(() => undefined);
  });
