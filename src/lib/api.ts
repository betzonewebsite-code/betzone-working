// Browser-side fetch wrapper. On a 401 it refreshes the session once (shared across parallel calls) and retries.
export type ApiResult<T = any> = { ok: boolean; status: number; data: T }; // eslint-disable-line @typescript-eslint/no-explicit-any

let refreshing: Promise<boolean> | null = null;
const refresh = () => (refreshing ??= fetch("/api/auth/refresh", { method: "POST" }).then((r) => r.ok).catch(() => false).finally(() => { refreshing = null; }));
const NO_RETRY = /^\/api\/auth\/(login|register|verify-otp|resend-otp|refresh|logout)/;

export async function api<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const go = () => fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  let r = await go();
  if (r.status === 401 && !NO_RETRY.test(path) && (await refresh())) r = await go();
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T };
}
