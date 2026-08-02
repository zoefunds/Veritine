const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Thin fetch wrapper that always sends the session cookie and parses JSON. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
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
