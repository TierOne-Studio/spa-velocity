type ApiEnvelope<T> = { data: T };

export class VectordbApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'VectordbApiError';
    this.status = status;
    this.body = body;
  }
}

export async function parseVectordbResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : fallbackMessage;
    throw new VectordbApiError(message, response.status, body);
  }
  if (response.status === 204) return undefined as T;
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}
