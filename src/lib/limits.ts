// Display limits only. The server enforces the real ones (see the betting rules in .env).
export const MIN_DEP = 1, MAX_DEP = 10_000, MIN_WD = 5;
export const NETWORKS = [
  { id: "mtn", label: "MTN MoMo" },
  { id: "telecel", label: "Telecel Cash (Vodafone)" },
  { id: "airteltigo", label: "AirtelTigo Money" },
];
export const fmt = (n: string | number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
