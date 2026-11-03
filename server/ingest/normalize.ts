export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const clampOdds = (d: number) => Math.max(1.01, Math.min(1000, d));

/** "-110" -> 1.909, "+250" -> 3.5 */
export function americanToDecimal(a: unknown): number | null {
  const n = Number(a);
  if (!Number.isFinite(n) || n === 0) return null;
  return round3(n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n));
}

export const num = (v: unknown): number | null => { const n = Number(v); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n; };
export const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const lineKey = (l: number | null) => (l === null ? "" : String(l));
export const fmtLine = (l: number) => (l > 0 ? `+${l}` : String(l));

/** Double chance prices derived from the 1X2 prices: 1 / (1/a + 1/b). */
export function deriveDoubleChance(h: number, d: number, a: number) {
  const dc = (x: number, y: number) => clampOdds(round3(1 / (1 / x + 1 / y)));
  return { "1x": dc(h, d), "12": dc(h, a), x2: dc(d, a) };
}

// ── team-name matching across providers ("Man City" vs "Manchester City")
const NOISE = /\b(fc|cf|afc|ac|as|sc|sv|fk|ssc|us|ud|cd|rc|rcd|de|the|club|calcio)\b/g;
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const tokens = (s: string) => fold(s).replace(NOISE, " ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

function similar(a: string, b: string) {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const hits = short.filter((t) => long.some((u) => u.startsWith(t) || t.startsWith(u))).length;
  return hits / short.length >= 0.6;
}
export function sameMatch(a: { home: string; away: string; kickoff: Date }, b: { home: string; away: string; kickoff: Date }) {
  return Math.abs(a.kickoff.getTime() - b.kickoff.getTime()) <= 3 * 3_600_000 && similar(a.home, b.home) && similar(a.away, b.away);
}
