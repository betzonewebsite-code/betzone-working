import { createHmac } from "crypto";

export type Team = { name: string; att: number; def: number };
export type Goal = { minute: number; side: "h" | "a" };

// Fixed simulation ratings; these are not claims about real-world form.
export const PREMIER_LEAGUE_TEAMS: Team[] = [
  { name: "Arsenal", att: 1.18, def: 1.16 },
  { name: "Aston Villa", att: 1.10, def: 1.02 },
  { name: "Bournemouth", att: 1.00, def: 0.94 },
  { name: "Brentford", att: 1.02, def: 0.98 },
  { name: "Brighton & Hove Albion", att: 1.08, def: 1.00 },
  { name: "Chelsea", att: 1.13, def: 1.05 },
  { name: "Coventry City", att: 0.98, def: 0.96 },
  { name: "Crystal Palace", att: 0.97, def: 1.02 },
  { name: "Everton", att: 0.91, def: 1.04 },
  { name: "Fulham", att: 1.01, def: 0.99 },
  { name: "Hull City", att: 0.94, def: 0.94 },
  { name: "Ipswich Town", att: 0.96, def: 0.92 },
  { name: "Leeds United", att: 1.05, def: 0.96 },
  { name: "Liverpool", att: 1.19, def: 1.12 },
  { name: "Manchester City", att: 1.22, def: 1.18 },
  { name: "Manchester United", att: 1.08, def: 1.00 },
  { name: "Newcastle United", att: 1.12, def: 1.02 },
  { name: "Nottingham Forest", att: 0.98, def: 1.00 },
  { name: "Sunderland", att: 0.95, def: 0.95 },
  { name: "Tottenham Hotspur", att: 1.13, def: 0.98 },
];

export const CHAMPIONSHIP_TEAMS: Team[] = [
  { name: "Birmingham City", att: 1.02, def: 1.00 },
  { name: "Blackburn Rovers", att: 1.00, def: 0.98 },
  { name: "Bolton Wanderers", att: 0.98, def: 0.99 },
  { name: "Bristol City", att: 1.01, def: 1.00 },
  { name: "Burnley", att: 1.10, def: 1.08 },
  { name: "Cardiff City", att: 0.96, def: 0.98 },
  { name: "Charlton Athletic", att: 0.97, def: 0.97 },
  { name: "Derby County", att: 1.00, def: 0.99 },
  { name: "Lincoln City", att: 0.98, def: 1.02 },
  { name: "Middlesbrough", att: 1.08, def: 1.02 },
  { name: "Millwall", att: 0.96, def: 1.05 },
  { name: "Norwich City", att: 1.08, def: 0.96 },
  { name: "Portsmouth", att: 1.00, def: 0.99 },
  { name: "Preston North End", att: 0.97, def: 1.02 },
  { name: "Queens Park Rangers", att: 0.98, def: 0.98 },
  { name: "Sheffield United", att: 1.07, def: 1.04 },
  { name: "Southampton", att: 1.09, def: 0.99 },
  { name: "Stoke City", att: 0.98, def: 1.03 },
  { name: "Swansea City", att: 1.02, def: 0.98 },
  { name: "Watford", att: 1.03, def: 0.98 },
  { name: "West Bromwich Albion", att: 1.05, def: 1.04 },
  { name: "West Ham United", att: 1.07, def: 0.98 },
  { name: "Wolverhampton Wanderers", att: 1.03, def: 1.04 },
  { name: "Wrexham", att: 1.00, def: 0.96 },
];

export const TEAMS: Team[] = [...PREMIER_LEAGUE_TEAMS, ...CHAMPIONSHIP_TEAMS];

function stream(seed: string, label: string) {
  let counter = 0;
  let pool: number[] = [];
  return () => {
    if (!pool.length) {
      pool = [...createHmac("sha256", seed).update(`${label}:${counter++}`).digest()];
    }
    return pool.shift()! / 256;
  };
}

export function draw(seed: string, count: number, teams: Team[] = TEAMS): [Team, Team][] {
  if (!Number.isInteger(count) || count < 0 || count * 2 > teams.length) {
    throw new Error(`Cannot draw ${count} fixtures from ${teams.length} teams`);
  }
  const random = stream(seed, "fixtures");
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Array.from({ length: count }, (_, i) => [shuffled[i * 2], shuffled[i * 2 + 1]]);
}

export function lambdas(home: Team, away: Team) {
  const lamH = Math.max(0.25, Math.min(3.5, 1.38 * home.att / away.def));
  const lamA = Math.max(0.2, Math.min(3.2, 1.08 * away.att / home.def));
  return { lamH, lamA };
}

function poisson(lambda: number, random: () => number) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let k = 0;
  do {
    k++;
    product *= random();
  } while (product > limit && k < 12);
  return k - 1;
}

function poissonProb(lambda: number, goals: number) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= goals; i++) p *= lambda / i;
  return p;
}

export function marketProbs(lamH: number, lamA: number) {
  let p1 = 0, px = 0, p2 = 0, under = 0, gg = 0;
  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      const p = poissonProb(lamH, h) * poissonProb(lamA, a);
      if (h > a) p1 += p;
      else if (h === a) px += p;
      else p2 += p;
      if (h + a < 3) under += p;
      if (h > 0 && a > 0) gg += p;
    }
  }
  const total = p1 + px + p2;
  p1 /= total;
  px /= total;
  p2 /= total;
  const underP = under / total;
  const ggP = gg / total;
  return {
    p1, px, p2,
    over: 1 - underP,
    under: underP,
    gg: ggP,
    ng: 1 - ggP,
  };
}

export function price(probability: number, margin: number) {
  return Math.min(5.00, Number((1 / Math.max(0.01, probability * (1 - margin))).toFixed(2)));
}

export function simulate(seed: string, round: number, index: number, lamH: number, lamA: number) {
  const random = stream(seed, `score:${round}:${index}`);
  const hs = poisson(lamH, random);
  const as = poisson(lamA, random);
  const goals: Goal[] = [];
  for (let i = 0; i < hs; i++) goals.push({ minute: 1 + Math.floor(random() * 90), side: "h" });
  for (let i = 0; i < as; i++) goals.push({ minute: 1 + Math.floor(random() * 90), side: "a" });
  goals.sort((a, b) => a.minute - b.minute);
  return { hs, as, goals };
}


// Team strength and match analysis
export type TeamStrength = {
  overall: number;
  attack: number;
  defence: number;
};

export type MatchAnalysis = {
  homeStrength: TeamStrength;
  awayStrength: TeamStrength;
  homeWin: number;
  draw: number;
  awayWin: number;
};

export function getTeamStrength(team: Team): TeamStrength {
  const attack = Math.max(1, Math.min(99, Math.round(50 + (team.att - 1) * 100)));
  const defence = Math.max(1, Math.min(99, Math.round(50 + (team.def - 1) * 100)));
  const overall = Math.round(attack * 0.5 + defence * 0.5);

  return { overall, attack, defence };
}

export function getMatchAnalysis(home: Team, away: Team): MatchAnalysis {
  const { lamH, lamA } = lambdas(home, away);
  const probabilities = marketProbs(lamH, lamA);

  // Normalize percentages so the three outcomes always total exactly 100.
  const total = probabilities.p1 + probabilities.px + probabilities.p2;
  const homeWin = Math.round((probabilities.p1 / total) * 100);
  const draw = Math.round((probabilities.px / total) * 100);
  const awayWin = 100 - homeWin - draw;

  return {
    homeStrength: getTeamStrength(home),
    awayStrength: getTeamStrength(away),
    homeWin,
    draw,
    awayWin,
  };
}

export function getTeamFormSummary(team: Team) {
  const strength = getTeamStrength(team);

  return {
    name: team.name,
    strength,
    attackRating: strength.attack,
    defenceRating: strength.defence,
    overallRating: strength.overall,
    historyLabel: "Virtual team rating",
    historyAvailable: false,
    message: "Completed match history will be shown here as virtual fixtures are played.",
  };
}
