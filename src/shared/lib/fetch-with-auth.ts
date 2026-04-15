/**
 * Wrapper for fetch that includes bearer token authentication
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("bearer_token");
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Bearer-first architecture: omit cookies by default so the backend never
  // sees a stale session cookie alongside the Authorization header. Keeping
  // both caused impersonation to resolve the original admin's session because
  // Better Auth's bearer plugin appends (not replaces) the session cookie.
  return fetch(url, {
    ...options,
    credentials: options.credentials ?? "omit",
    headers,
  });
}

/**
 * Authenticated fetch that auto-throws on non-2xx responses.
 * Returns parsed JSON of type T, or void for 204 responses.
 */
export async function fetchApi<T = void>(
  url: string,
  options?: RequestInit,
  fallbackMessage = "Request failed"
): Promise<T> {
  const response = await fetchWithAuth(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { message?: string }).message || fallbackMessage
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
