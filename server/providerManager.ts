
type ProviderName = "sportsgameodds" | "sportmonks" | "the-odds-api";

type ProviderResult = {
  provider: ProviderName;
  data: unknown;
  fetchedAt: number;
  stale: boolean;
};

type ProviderConfig = {
  name: ProviderName;
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
};

const CACHE_TTL_MS = 30_000;
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 12_000;

const cache = new Map<string, ProviderResult>();
const cooldownUntil = new Map<ProviderName, number>();
const failures = new Map<ProviderName, number>();
const inFlight = new Map<string, Promise<ProviderResult | null>>();

function configFor(name: ProviderName): ProviderConfig {
  const env = process.env;

  if (name === "sportsgameodds") {
    const base = (
      env.SPORTSGAMEODDS_API_BASE_URL ||
      "https://api.sportsgameodds.com/v2"
    ).replace(/\/+$/, "").replace(/\/v1$/, "").replace(/\/v2$/, "");

    return {
      name,
      url: `${base}/v2/events`,
      headers: {
        "x-api-key": env.SPORTSGAMEODDS_API_KEY || "",
      },
      enabled: Boolean(env.SPORTSGAMEODDS_API_KEY),
    };
  }

  if (name === "sportmonks") {
    const base = (
      env.SPORTMONKS_API_BASE_URL ||
      "https://api.sportmonks.com/v3/football"
    ).replace(/\/+$/, "");

    return {
      name,
      url: /\/v\d+$/.test(base) ? `${base}/football` : base,
      headers: {},
      enabled: Boolean(env.SPORTMONKS_API_KEY),
    };
  }

  return {
    name,
    url: (
      env.THE_ODDS_API_BASE_URL ||
      "https://api.the-odds-api.com/v4"
    ).replace(/\/+$/, ""),
    headers: {},
    enabled: Boolean(env.THE_ODDS_API_KEY),
  };
}

function cooldownFor(name: ProviderName): number {
  const count = failures.get(name) ?? 1;
  return Math.min(
    DEFAULT_COOLDOWN_MS * 2 ** Math.max(0, count - 1),
    MAX_COOLDOWN_MS,
  );
}

async function requestProvider(
  name: ProviderName,
  endpoint: string,
  params: Record<string, string> = {},
): Promise<ProviderResult | null> {
  const config = configFor(name);
  if (!config.enabled) return null;

  const cacheKey = `${name}:${endpoint}:${new URLSearchParams(params).toString()}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  if ((cooldownUntil.get(name) ?? 0) > now) {
    return cached ? { ...cached, stale: true } : null;
  }

  const requestKey = `${name}:${endpoint}:${new URLSearchParams(params).toString()}`;
  const existing = inFlight.get(requestKey);
  if (existing) return existing;

  const task = (async (): Promise<ProviderResult | null> => {
    const url = new URL(
      `${config.url.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`,
    );

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    if (name === "sportmonks") {
      url.searchParams.set("api_token", process.env.SPORTMONKS_API_KEY!);
    } else if (name === "the-odds-api") {
      url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY!);
    }

    try {
      const response = await fetch(url, {
        headers: config.headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = response.status === 429 && retryAfter > 0
          ? Math.min(retryAfter * 1000, MAX_COOLDOWN_MS)
          : cooldownFor(name);

        if (
          response.status === 429 ||
          response.status === 401 ||
          response.status === 403
        ) {
          cooldownUntil.set(name, now + delay);
        } else {
          cooldownUntil.set(name, now + delay);
        }

        failures.set(name, (failures.get(name) ?? 0) + 1);

        // Do not log URLs: some providers accept credentials in query strings.
        console.warn(
          `[ProviderManager] ${name} returned HTTP ${response.status}; provider temporarily paused.`,
        );

        return cached ? { ...cached, stale: true } : null;
      }

      const data: unknown = await response.json();

      // A successful response resets the provider's failure state.
      failures.delete(name);
      cooldownUntil.delete(name);

      const result: ProviderResult = {
        provider: name,
        data,
        fetchedAt: Date.now(),
        stale: false,
      };

      cache.set(cacheKey, result);
      return result;
    } catch {
      cooldownUntil.set(name, now + cooldownFor(name));
      failures.set(name, (failures.get(name) ?? 0) + 1);

      console.warn(
        `[ProviderManager] ${name} request failed; provider temporarily paused.`,
      );

      return cached ? { ...cached, stale: true } : null;
    }
  })();

  inFlight.set(requestKey, task);

  try {
    return await task;
  } finally {
    inFlight.delete(requestKey);
  }
}

/**
 * Fetches providers in priority order, returning the first successful,
 * fresh response. A cached response is used only if no fresh provider works.
 */
export async function fetchWithProviderFallback(
  requests: Array<{
    provider: ProviderName;
    endpoint: string;
    params?: Record<string, string>;
  }>,
): Promise<ProviderResult | null> {
  let staleFallback: ProviderResult | null = null;

  for (const request of requests) {
    const result = await requestProvider(
      request.provider,
      request.endpoint,
      request.params,
    );

    if (!result) continue;

    if (!result.stale) return result;
    staleFallback ??= result;
  }

  return staleFallback;
}

