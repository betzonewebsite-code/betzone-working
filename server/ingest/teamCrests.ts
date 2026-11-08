import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/server/db";

type TeamResult = {
  strTeam?: string;
  strSport?: string;
  strLeague?: string;
  strBadge?: string;
};

type SearchResponse = {
  teams?: TeamResult[] | null;
};

type CacheEntry = {
  badge: string | null;
  nextRetryAt: number;
  attempts: number;
};

type CrestCache = Record<string, CacheEntry>;

type TeamIdentity = {
  name: string;
  searchName: string;
  key: string;
  acceptedNames: string[];
};

type MissingTeam = TeamIdentity & {
  league: string;
};

const API_URL =
  "https://www.thesportsdb.com/api/v1/json/123/searchteams.php";

const CACHE_FILE = path.join(
  process.cwd(),
  "data",
  "team-crest-cache.json",
);

const MAX_LOOKUPS_PER_RUN = 5;
const REQUEST_INTERVAL_MS = 2500;
const SUCCESS_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 60 * 60 * 1000;
const RATE_LIMIT_RETRY_MS = 6 * 60 * 60 * 1000;

const TEAM_ALIASES: Array<{
  searchName: string;
  aliases: string[];
}> = [
  {
    searchName: "Atalanta",
    aliases: ["Atalanta", "Atalanta BC"],
  },
  {
    searchName: "Osasuna",
    aliases: ["Osasuna", "CA Osasuna"],
  },
  {
    searchName: "Sporting CP",
    aliases: ["Sporting CP", "Sporting Lisbon"],
  },
  {
    searchName: "Shakhtar Donetsk",
    aliases: ["Shakhtar Donetsk"],
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(football club|fc|cf|afc|sc|ac|bc|ca)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

function identifyTeam(name: string): TeamIdentity {
  const normalized = normalize(name);

  const alias = TEAM_ALIASES.find((entry) =>
    entry.aliases.some(
      (candidate) => normalize(candidate) === normalized,
    ),
  );

  if (!alias) {
    return {
      name,
      searchName: name,
      key: normalized,
      acceptedNames: [normalized],
    };
  }

  const acceptedNames = alias.aliases.map(normalize);
  const key = normalize(alias.searchName);

  return {
    name,
    searchName: alias.searchName,
    key,
    acceptedNames,
  };
}

function leagueMatches(
  teamLeague: string,
  fixtureLeague: string,
): boolean {
  const team = normalize(teamLeague);
  const fixture = normalize(fixtureLeague);

  return Boolean(
    team &&
    fixture &&
    (team.includes(fixture) || fixture.includes(team)),
  );
}

async function readCache(): Promise<CrestCache> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as CrestCache;
  } catch {
    return {};
  }
}

async function saveCache(cache: CrestCache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });

  const temporaryFile = `${CACHE_FILE}.tmp`;

  await fs.writeFile(
    temporaryFile,
    JSON.stringify(cache, null, 2),
    "utf8",
  );

  await fs.rename(temporaryFile, CACHE_FILE);
}

async function lookupBadge(
  team: MissingTeam,
  cache: CrestCache,
): Promise<string | null> {
  const key = team.key;
  const cached = cache[key];

  if (cached && cached.nextRetryAt > Date.now()) {
    return cached.badge;
  }

  const url = new URL(API_URL);
  url.searchParams.set("t", team.searchName);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (response.status === 429) {
    cache[key] = {
      badge: null,
      attempts: (cached?.attempts ?? 0) + 1,
      nextRetryAt: Date.now() + RATE_LIMIT_RETRY_MS,
    };

    await saveCache(cache);

    console.warn(
      `[team-crests] Rate limited: ${team.name}. Retry scheduled later.`,
    );

    return null;
  }

  if (!response.ok) {
    throw new Error(
      `TheSportsDB returned HTTP ${response.status} for ${team.name}`,
    );
  }

  const payload = (await response.json()) as SearchResponse;

  const candidates = (payload.teams ?? []).filter((result) => {
    if (result.strSport?.toLowerCase() !== "soccer") {
      return false;
    }

    if (
      !result.strTeam ||
      !team.acceptedNames.includes(normalize(result.strTeam))
    ) {
      return false;
    }

    return Boolean(
      result.strBadge &&
      /^https:\/\//i.test(result.strBadge),
    );
  });

  // Prefer the club's domestic league when multiple exact-name
  // candidates exist, but do not reject a verified club in a cup
  // or international competition.
  const leagueCandidates = candidates.filter(
    (result) =>
      result.strLeague &&
      leagueMatches(result.strLeague, team.league),
  );

  const selected =
    leagueCandidates.length === 1
      ? leagueCandidates[0]
      : candidates.length === 1
        ? candidates[0]
        : null;

  const badge = selected?.strBadge ?? null;

  cache[key] = {
    badge,
    attempts: (cached?.attempts ?? 0) + 1,
    nextRetryAt:
      Date.now() +
      (badge ? SUCCESS_RETRY_MS : FAILURE_RETRY_MS),
  };

  await saveCache(cache);

  return badge;
}

export async function enrichMissingTeamCrests(): Promise<number> {
  const [existing, fixtures] = await Promise.all([
    db.fixture.findMany({
      where: {
        sport: "SOCCER",
        OR: [
          { homeLogo: { not: null } },
          { awayLogo: { not: null } },
        ],
      },
      select: {
        homeTeam: true,
        awayTeam: true,
        homeLogo: true,
        awayLogo: true,
      },
    }),

    db.fixture.findMany({
      where: {
        sport: "SOCCER",
        status: { not: "FINISHED" },
      },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        homeLogo: true,
        awayLogo: true,
        league: {
          select: { name: true },
        },
      },
      orderBy: { kickoffAt: "asc" },
      take: 500,
    }),
  ]);

  const cache = await readCache();
  const knownBadges = new Map<string, string>();

  // Reuse badges already saved in the database.
  for (const fixture of existing) {
    if (fixture.homeLogo) {
      knownBadges.set(
        identifyTeam(fixture.homeTeam).key,
        fixture.homeLogo,
      );
    }

    if (fixture.awayLogo) {
      knownBadges.set(
        identifyTeam(fixture.awayTeam).key,
        fixture.awayLogo,
      );
    }
  }

  // Reuse successful cached badges without API requests.
  for (const [teamKey, entry] of Object.entries(cache)) {
    if (entry.badge && /^https:\/\//i.test(entry.badge)) {
      knownBadges.set(teamKey, entry.badge);
    }
  }

  const missingTeams = new Map<string, MissingTeam>();

  for (const fixture of fixtures) {
    for (const name of [fixture.homeTeam, fixture.awayTeam]) {
      const identity = identifyTeam(name);

      if (
        identity.key &&
        !knownBadges.has(identity.key) &&
        !missingTeams.has(identity.key)
      ) {
        missingTeams.set(identity.key, {
          ...identity,
          league: fixture.league.name,
        });
      }
    }
  }

  const pending = [...missingTeams.values()]
    .filter((team) => {
      const entry = cache[team.key];

      return !entry || entry.nextRetryAt <= Date.now();
    })
    .slice(0, MAX_LOOKUPS_PER_RUN);

  console.log(
    `[team-crests] Missing unique clubs=${missingTeams.size}; ` +
    `eligible lookups this run=${pending.length}.`,
  );

  let lookups = 0;

  for (const team of pending) {
    if (lookups > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, REQUEST_INTERVAL_MS),
      );
    }

    lookups++;

    try {
      const badge = await lookupBadge(team, cache);

      if (badge) {
        knownBadges.set(team.key, badge);

        console.log(
          `[team-crests] Found crest: ${team.name}`,
        );
      }
    } catch (error) {
      const previous = cache[team.key];

      cache[team.key] = {
        badge: null,
        attempts: (previous?.attempts ?? 0) + 1,
        nextRetryAt: Date.now() + FAILURE_RETRY_MS,
      };

      await saveCache(cache);

      console.warn(
        `[team-crests] Lookup failed for ${team.name}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  let updated = 0;

  for (const fixture of fixtures) {
    const data: {
      homeLogo?: string;
      awayLogo?: string;
    } = {};

    if (!fixture.homeLogo) {
      const badge = knownBadges.get(
        identifyTeam(fixture.homeTeam).key,
      );

      if (badge) data.homeLogo = badge;
    }

    if (!fixture.awayLogo) {
      const badge = knownBadges.get(
        identifyTeam(fixture.awayTeam).key,
      );

      if (badge) data.awayLogo = badge;
    }

    if (Object.keys(data).length === 0) continue;

    await db.fixture.update({
      where: { id: fixture.id },
      data,
    });

    updated++;
  }

  if (updated > 0) {
    console.log(
      `[team-crests] Added missing club crests to ${updated} fixtures.`,
    );
  }

  return updated;
}
