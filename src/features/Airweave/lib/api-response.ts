/**
 * Shared envelope-parsing helper for Airweave API responses.
 *
 * api-velocity wraps successful response bodies in `{ data: T }`. This
 * helper unwraps that envelope and throws a typed `AirweaveApiError` on
 * non-2xx so callers can `instanceof`-check the error and read the
 * structured body (e.g. delete-conflict project list, 429 retry-after).
 *
 * Mirrors the shape of the original `parseApiResponse` in
 * `src/features/Admin/hooks/useAirweaveCollections.ts` — extracted here
 * to avoid divergence between the legacy LIST hook and the new feature
 * services.
 */

type ApiEnvelope<T> = { data: T };

export class AirweaveApiError extends Error {
  /** HTTP status code (404, 409, 429, 502, ...). */
  readonly status: number;
  /** Parsed response body (may be `{}` if the body wasn't JSON). */
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'AirweaveApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Unwrap a `{data: T}` envelope from a `fetch` Response, or throw a typed
 * `AirweaveApiError` on non-2xx. Returns `undefined` (cast to T) for 204
 * No Content responses (DELETE endpoints).
 */
export async function parseAirweaveResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { message?: unknown }).message === 'string'
        ? ((body as { message: string }).message)
        : fallbackMessage;
    throw new AirweaveApiError(message, response.status, body);
  }
  if (response.status === 204) return undefined as T;
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}
