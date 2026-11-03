import { env } from "./src/lib/server/env";

console.log({
  primary: env.SPORTS_PRIMARY,
  secondary: env.SPORTS_SECONDARY,
  tertiary: env.SPORTS_TERTIARY,
  leagues: env.SPORTS_LEAGUES,
  livePollSeconds: env.SPORTS_POLL_LIVE_SEC,
  upcomingPollSeconds: env.SPORTS_POLL_UPCOMING_SEC,
});
