type ApiEnvelope<T> = { data: T };

export class VectorDbApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'VectorDbApiError';
    this.status = status;
    this.body = body;
  }
}

export async function parseVectorDbResponse<T>(
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
    throw new VectorDbApiError(message, response.status, body);
  }
  if (response.status === 204) return undefined;
  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    throw new VectorDbApiError(fallbackMessage, response.status, null);
  }
  if (envelope === null || typeof envelope !== 'object') {
    throw new VectorDbApiError(fallbackMessage, response.status, envelope);
  }
  return (envelope as ApiEnvelope<T>).data;
}

/** For endpoints whose success contract always carries a body — an empty 2xx is a server bug, not a value. */
export async function requireVectorDbData<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await parseVectorDbResponse<T>(response, fallbackMessage);
  if (data == null) {
    throw new VectorDbApiError(fallbackMessage, response.status, null);
  }
  return data;
}
