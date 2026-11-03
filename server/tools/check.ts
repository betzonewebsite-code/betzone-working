import { env } from "../../src/lib/server/env";

async function main() {
  const key = env.SPORTSGAMEODDS_API_KEY?.trim();
  if (!key) throw new Error("SportsGameOdds API key missing");

  const url = new URL("https://api.sportsgameodds.com/v2/events");
  url.searchParams.set("leagueID", "UEFA_CHAMPIONS_LEAGUE");
  url.searchParams.set("live", "true");
  url.searchParams.set("started", "true");
  url.searchParams.set("limit", "50");

  const response = await fetch(url, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(20000),
  });

  console.log("HTTP:", response.status);

  const body: any = await response.json();

  if (!response.ok || body.success === false) {
    console.log("API error:", body.error ?? body);
    return;
  }

  const events = Array.isArray(body.data) ? body.data : [];

  console.log("Live UCL events:", events.length);

  for (const ev of events) {
    console.log("\nMatch:", ev.teams?.home?.names?.long, "vs", ev.teams?.away?.names?.long);
    console.log("Scores:", JSON.stringify(ev.scores ?? null));
    console.log("Status:", JSON.stringify(ev.status ?? {}));
  }
}

main().catch(e => {
  console.error("Diagnostic failed:", e.message);
  process.exitCode = 1;
});
