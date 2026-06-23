// Mirrors the per-feature {data} envelope helper used across the SPA
// (VectorDb/lib/apiResponse.ts, Airweave/lib/api-response.ts). The API wraps
// success bodies as { data: T }; errors carry a { message } field.
type ApiEnvelope<T> = { data: T };

export class EmbedSiteApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'EmbedSiteApiError';
    this.status = status;
    this.body = body;
  }
}

export async function parseEmbedSiteResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T | undefined> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : fallbackMessage;
    throw new EmbedSiteApiError(message, response.status, body);
  }
  if (response.status === 204) return undefined;
  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    throw new EmbedSiteApiError(fallbackMessage, response.status, null);
  }
  if (envelope === null || typeof envelope !== 'object') {
    throw new EmbedSiteApiError(fallbackMessage, response.status, envelope);
  }
  return (envelope as ApiEnvelope<T>).data;
}

/** For endpoints whose success contract always carries a body — an empty 2xx is a server bug. */
export async function requireEmbedSiteData<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await parseEmbedSiteResponse<T>(response, fallbackMessage);
  if (data == null) {
    throw new EmbedSiteApiError(fallbackMessage, response.status, null);
  }
  return data;
}
