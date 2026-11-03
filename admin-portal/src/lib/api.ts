/** Browser-side API client. Auth must be implemented by the existing backend.
 * Prefer secure HttpOnly same-site session cookies. Do not store admin bearer tokens in localStorage.
 */
export type ApiError = { error?: string; message?: string; code?: string };
const API_BASE = (process.env.NEXT_PUBLIC_BETZONE_API_URL || '').replace(/\/$/, '');
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new Error('NEXT_PUBLIC_BETZONE_API_URL is not configured.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiError;
    throw new Error(body.message || body.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
