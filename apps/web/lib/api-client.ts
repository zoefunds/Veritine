// The NestJS API sets a global 'api/v1' prefix (see apps/api/src/main.ts) -
// every call must include it. Centralized here so it's never duplicated
// or forgotten at individual call sites.
const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;

/**
 * Thin fetch wrapper that always sends the session cookie and parses JSON.
 * `cache: 'no-store'` is set explicitly rather than relying on the
 * `force-dynamic` route segment config alone - Vercel's Data Cache can
 * still serve a stale response for a plain `fetch()` across deployments
 * unless the fetch itself opts out, which caused the dispute explorer to
 * keep showing disputes from an already-truncated database.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : res.statusText;
    throw new Error(message);
  }

  return body as T;
}
