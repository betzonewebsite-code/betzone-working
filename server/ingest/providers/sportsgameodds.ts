/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FixtureStatus } from "@prisma/client";
import { env } from "../../../src/lib/server/env";
import {
  americanToDecimal,
  clampOdds,
  deriveDoubleChance,
  fmtLine,
  num,
} from "../normalize";
import type {
  FinalScore,
  LeagueDef,
  NFixture,
  NMarket,
  NSelection,
  Provider,
} from "../types";
import { leagueByKey, leagueBySgo } from "../leagues";

const BASE = "https://api.sportsgameodds.com/v2";

type Price = {
  dec: number;
  line: number | null;
  available: boolean;
};

async function get(path: string, params: Record<string, string>) {
  if (!env.SPORTSGAMEODDS_API_KEY) {
    throw new Error("SPORTSGAMEODDS_API_KEY is not set");
  }

  const url = new URL(BASE + path);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "x-api-key": env.SPORTSGAMEODDS_API_KEY,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 429) {
    throw new Error(
      "SportsGameOdds rate limit hit. Reduce polling frequency.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `SportsGameOdds ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }

  const body = (await response.json()) as any;

  if (body?.success === false) {
    throw new Error(
      `SportsGameOdds API error: ${body.error ?? "Unknown error"}`,
    );
  }

  return body;
}

async function pageEvents(
  params: Record<string, string>,
): Promise<any[]> {
  const output: any[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 10; page++) {
    const response = await get("/events", {
      ...params,
      limit: "50",
      ...(cursor ? { cursor } : {}),
    });

    output.push(...(Array.isArray(response.data) ? response.data : []));

    cursor = response.nextCursor;

    if (!cursor) break;
  }

  return output;
}

/** Price from a preferred bookmaker, falling back to consensus. */
function price(odd: any, books: string[]): Price | null {
  const bookmakers = odd?.byBookmaker ?? {};

  for (const bookmaker of books) {
    const item = bookmakers[bookmaker];
    const decimal = item?.odds != null
      ? americanToDecimal(item.odds)
      : null;

    if (decimal) {
      return {
        dec: decimal,
        line: num(item.spread ?? item.overUnder),
        available: item.available !== false && !odd.ended,
      };
    }
  }

  const decimal = americanToDecimal(
    odd?.bookOdds ?? odd?.fairOdds,
  );

  if (!decimal) return null;

  return {
    dec: decimal,
    line: num(
      odd.bookSpread ??
      odd.bookOverUnder ??
      odd.fairSpread ??
      odd.fairOverUnder,
    ),
    available:
      odd.available !== false &&
      !odd.ended &&
      !odd.cancelled,
  };
}

/**
 * Provider status mapping.
 *
 * ended means play has stopped.
 * finalized means the provider has settled/confirmed the result.
 *
 * Both are retained separately. A FINISHED fixture with finalized=false
 * must still be treated as an unconfirmed result by settlement logic.
 */
function statusOf(
  st: any,
): { status: FixtureStatus; finalized: boolean } {
  const text = `${st.displayShort ?? ""} ${st.displayLong ?? ""}`;

  if (st.cancelled) {
    return {
      status: "CANCELLED",
      finalized: false,
    };
  }

  if (st.delayed) {
    return {
      status: "POSTPONED",
      finalized: false,
    };
  }

  if (st.finalized) {
    return {
      status: "FINISHED",
      finalized: true,
    };
  }

  if (st.ended) {
    return {
      status: "FINISHED",
      finalized: false,
    };
  }

  if (st.started) {
    const halftime =
      /half\s*-?\s*time|^\s*ht\b/i.test(text);

    return {
      status: halftime ? "HALFTIME" : "LIVE",
      finalized: false,
    };
  }

  return {
    status: "SCHEDULED",
    finalized: false,
  };
}

export function parseSgoEvent(
  ev: any,
  league: LeagueDef,
  books: string[],
  _now = new Date(),
): NFixture | null {
  const home =
    ev?.teams?.home?.names?.long ??
    ev?.teams?.home?.names?.medium;

  const away =
    ev?.teams?.away?.names?.long ??
    ev?.teams?.away?.names?.medium;

  const statusData = ev?.status ?? {};
  const startsAt = statusData.startsAt;

  if (!ev?.eventID || !home || !away || !startsAt) {
    return null;
  }

  const { status, finalized } = statusOf(statusData);

  const kickoff = new Date(startsAt);

  if (Number.isNaN(kickoff.getTime())) {
    return null;
  }

  const homeScore = num(ev.scores?.home);
  const awayScore = num(ev.scores?.away);

  // Never invent a 0-0 score when the provider has no score.
  const score: [number, number] | null =
    homeScore !== null && awayScore !== null
      ? [homeScore, awayScore]
      : null;

  // Use the provider clock only. Never estimate match minutes from kickoff.
  let minute: number | null = null;

  const period = (
    statusData.displayShort ??
    statusData.currentPeriodID ??
    null
  ) as string | null;

  if (
    league.sport === "SOCCER" &&
    (status === "LIVE" || status === "HALFTIME")
  ) {
    const clock = String(
      statusData.clock ?? statusData.displayShort ?? "",
    );

    const match = /^\s*(\d{1,3})/.exec(clock);

    if (match) {
      minute = Math.min(Number(match[1]), 130);
    }
  }

  // Index full-game odds only.
  const index = new Map<
    string,
    {
      odd: any;
      stat: string;
      ent: string;
      bet: string;
      side: string;
    }
  >();

  for (const [id, odd] of Object.entries<any>(ev.odds ?? {})) {
    const [stat, entity, periodId, bet, side] = id.split("-");

    if (periodId === "game") {
      index.set(
        `${stat}|${entity}|${bet}|${side}`,
        { odd, stat, ent: entity, bet, side },
      );
    }
  }

  const get1 = (
    stat: string,
    entity: string,
    bet: string,
    side: string,
  ): Price | null => {
    const item = index.get(
      `${stat}|${entity}|${bet}|${side}`,
    );

    return item ? price(item.odd, books) : null;
  };

  const bySide = (
    bet: string,
    side: string,
  ): Price | null => {
    for (const item of index.values()) {
      if (
        item.bet === bet &&
        item.side === side &&
        item.stat === "points"
      ) {
        return price(item.odd, books);
      }
    }

    return null;
  };

  const selection = (
    key: string,
    label: string,
    item: Price,
  ): NSelection => ({
    key,
    label,
    odds: clampOdds(item.dec),
    available: item.available,
  });

  const markets: NMarket[] = [];

  if (league.sport === "SOCCER") {
    const homeWin = get1("points", "home", "ml3way", "home");
    const draw = get1("points", "all", "ml3way", "draw");
    const awayWin = get1("points", "away", "ml3way", "away");

    if (homeWin && draw && awayWin) {
      markets.push({
        type: "ONE_X_TWO",
        line: null,
        name: "1X2",
        selections: [
          selection("1", "Home", homeWin),
          selection("X", "Draw", draw),
          selection("2", "Away", awayWin),
        ],
      });

      const dc1x = bySide("ml3way", "home+draw");
      const dcx2 = bySide("ml3way", "away+draw");
      const dc12 = bySide("ml3way", "not_draw");

      const derived = deriveDoubleChance(
        homeWin.dec,
        draw.dec,
        awayWin.dec,
      );

      const available =
        homeWin.available &&
        draw.available &&
        awayWin.available;

      markets.push({
        type: "DOUBLE_CHANCE",
        line: null,
        name: "Double Chance",
        selections: [
          selection(
            "1x",
            "1X",
            dc1x ?? {
              dec: derived["1x"],
              line: null,
              available,
            },
          ),
          selection(
            "12",
            "12",
            dc12 ?? {
              dec: derived["12"],
              line: null,
              available,
            },
          ),
          selection(
            "x2",
            "X2",
            dcx2 ?? {
              dec: derived.x2,
              line: null,
              available,
            },
          ),
        ],
      });
    }

    // Both teams to score.
    let yes: Price | null = null;
    let no: Price | null = null;

    for (const item of index.values()) {
      if (
        item.bet === "yn" &&
        item.ent === "all" &&
        /both|btts/i.test(item.stat)
      ) {
        if (item.side === "yes") {
          yes = price(item.odd, books);
        }

        if (item.side === "no") {
          no = price(item.odd, books);
        }
      }
    }

    if (yes && no) {
      markets.push({
        type: "BTTS",
        line: null,
        name: "GG/NG",
        selections: [
          selection("gg", "GG (Yes)", yes),
          selection("ng", "NG (No)", no),
        ],
      });
    }
  } else if (league.sport === "BASKETBALL") {
    const homeWin = get1("points", "home", "ml", "home");
    const awayWin = get1("points", "away", "ml", "away");

    if (homeWin && awayWin) {
      markets.push({
        type: "MONEYLINE",
        line: null,
        name: "Moneyline",
        selections: [
          selection("h", home, homeWin),
          selection("a", away, awayWin),
        ],
      });
    }
  }

  const over = get1("points", "all", "ou", "over");
  const under = get1("points", "all", "ou", "under");

  if (
    over &&
    under &&
    over.line !== null
  ) {
    markets.push({
      type: "OVER_UNDER",
      line: over.line,
      name: `Over/Under ${over.line}`,
      selections: [
        selection("over", `Over ${over.line}`, over),
        selection("under", `Under ${under.line}`, under),
      ],
    });
  }

  const homeSpread = get1("points", "home", "sp", "home");
  const awaySpread = get1("points", "away", "sp", "away");

  if (homeSpread && awaySpread) {
    const line =
      homeSpread.line ??
      (awaySpread.line !== null ? -awaySpread.line : null);

    if (line !== null) {
      markets.push({
        type: "ASIAN_HANDICAP",
        line,
        name: `Handicap ${fmtLine(line)}`,
        selections: [
          selection(
            "h",
            `${home} ${fmtLine(line)}`,
            homeSpread,
          ),
          selection(
            "a",
            `${away} ${fmtLine(-line)}`,
            awaySpread,
          ),
        ],
      });
    }
  }

  return {
    source: "sportsgameodds",
    externalId: ev.eventID,
    leagueKey: league.key,
    home,
    away,
    kickoff,
    status,
    minute,
    period,
    score,
    finalized,
    markets,
  };
}

export const sportsGameOdds: Provider = {
  name: "sportsgameodds",

  async discoverLeagues(): Promise<LeagueDef[]> {
    const discovered = new Map<string, LeagueDef>();

    const requests = [
      {
        sportId: "SOCCER",
        sport: "SOCCER" as const,
      },
      {
        sportId: "BASKETBALL",
        sport: "BASKETBALL" as const,
      },
    ];

    for (const request of requests) {
      const response = await get("/leagues", {
        sportID: request.sportId,
      });

      const raw: any[] = Array.isArray(response?.data)
        ? response.data
        : Object.values(response?.data ?? {});

      for (const item of raw) {
        const id = String(
          item?.leagueID ?? item?.id ?? "",
        ).trim();

        if (!id) continue;

        const known =
          leagueBySgo(id) ??
          leagueByKey(id);

        const name = String(
          item?.name ??
          item?.leagueName ??
          item?.title ??
          id,
        ).trim();

        const definition: LeagueDef = {
          key:
            known?.key ??
            `SGO_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
          sport: known?.sport ?? request.sport,
          country:
            known?.country ??
            String(
              item?.country ??
              item?.countryName ??
              "International",
            ),
          name: known?.name ?? name,
          popular: known?.popular ?? false,
          sort: known?.sort ?? 1000 + discovered.size,
          sgo: id,
          oddsApi: known?.oddsApi,
        };

        discovered.set(definition.key, definition);
      }
    }

    return [...discovered.values()];
  },

  async fetchFixtures(leagues, { live }) {
    const definitions = leagues.filter(
      (league) => league.sgo,
    );

    if (!definitions.length) return [];

    const books = env.SGO_BOOKMAKERS
      .split(",")
      .map((book) => book.trim())
      .filter(Boolean);

    // Keep the request league-specific for the current subscription.
    // Live requests must not require oddsAvailable=true, because a match
    // can have live scores even when live odds are unavailable.
    const params: Record<string, string> = {
      leagueID: definitions
        .map((league) => league.sgo!)
        .join(","),
    };

    if (live) {
      params.live = "true";
    } else {
      params.oddsAvailable = "true";
    }

    const events = await pageEvents(params);

    const output: NFixture[] = [];

    for (const event of events) {
      const definition = definitions.find(
        (league) => league.sgo === event.leagueID,
      );

      const parsed = definition
        ? parseSgoEvent(event, definition, books)
        : null;

      if (parsed) {
        output.push(parsed);
      }
    }

    console.log(
      `[sportsgameodds] ${live ? "Live" : "Upcoming"} events received=${events.length}; parsed=${output.length}`,
    );

    return output;
  },

  async fetchFinals(leagues): Promise<FinalScore[]> {
    const definitions = leagues.filter(
      (league) => league.sgo,
    );

    if (!definitions.length) return [];

    const events = await pageEvents({
      leagueID: definitions
        .map((league) => league.sgo!)
        .join(","),
      finalized: "true",
    });

    const output: FinalScore[] = [];

    for (const event of events) {
      const definition = definitions.find(
        (league) => league.sgo === event.leagueID,
      );

      const home = event?.teams?.home?.names?.long;
      const away = event?.teams?.away?.names?.long;

      const homeScore = num(event?.scores?.home);
      const awayScore = num(event?.scores?.away);

      if (
        definition &&
        home &&
        away &&
        homeScore !== null &&
        awayScore !== null &&
        event.status?.startsAt
      ) {
        output.push({
          source: "sportsgameodds",
          externalId: event.eventID,
          leagueKey: definition.key,
          home,
          away,
          kickoff: new Date(event.status.startsAt),
          score: [homeScore, awayScore],
        });
      }
    }

    return output;
  },
};
