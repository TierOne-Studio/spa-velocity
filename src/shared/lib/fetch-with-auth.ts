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

  return fetch(url, {
    ...options,
    credentials: options.credentials ?? "include",
    headers,
  });
}
