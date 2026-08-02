// The NestJS API sets a global 'api/v1' prefix (see apps/api/src/main.ts) -
// every call must include it. Centralized here so it's never duplicated
// or forgotten at individual call sites.
const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;

/**
 * Thin fetch wrapper that always sends the session cookie and parses JSON.
 *
 * Reads use a short time-based revalidation window (`next: { revalidate: 5 }`)
 * rather than `cache: 'no-store'`: a fully uncached fetch on every single
 * navigation (combined with `force-dynamic` route segments) made every
 * page load a full uncached round trip to Fly.io/Postgres, which is what
 * made pages feel slow. A 5s window keeps repeat navigations fast by
 * serving a cached response, while still self-healing within a handful of
 * seconds - short enough that it doesn't reintroduce the earlier bug
 * where the explorer kept showing disputes from an already-truncated
 * database indefinitely. Mutations (POST/PUT/PATCH/DELETE) are never
 * cached by fetch regardless, and any caller needing a guaranteed-fresh
 * read (e.g. right after triggering a sync) can still pass `cache: 'no-store'`
 * explicitly via `init`.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    ...(init?.cache ? {} : { next: { revalidate: 5 } }),
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
