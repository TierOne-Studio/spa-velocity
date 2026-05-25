import { describe, expect, it } from 'vitest';
import { AirweaveApiError, parseAirweaveResponse } from '../api-response';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseAirweaveResponse', () => {
  it('unwraps the `data` envelope on 200', async () => {
    const response = jsonResponse({ data: { id: 'coll-1', name: 'X' } }, 200);
    await expect(
      parseAirweaveResponse<{ id: string; name: string }>(response, 'fallback'),
    ).resolves.toEqual({ id: 'coll-1', name: 'X' });
  });

  it('returns undefined for 204 No Content (DELETE responses)', async () => {
    const response = new Response(null, { status: 204 });
    await expect(
      parseAirweaveResponse<void>(response, 'fallback'),
    ).resolves.toBeUndefined();
  });

  it('throws AirweaveApiError with the body message on non-2xx', async () => {
    const response = jsonResponse(
      { message: 'collection is in use', projects: [{ id: 'p1', name: 'A' }] },
      409,
    );
    const failure = parseAirweaveResponse(response, 'fallback');
    await expect(failure).rejects.toBeInstanceOf(AirweaveApiError);
    try {
      await failure;
    } catch (err) {
      const e = err as AirweaveApiError;
      expect(e.message).toBe('collection is in use');
      expect(e.status).toBe(409);
      expect((e.body as { projects: unknown[] }).projects).toHaveLength(1);
    }
  });

  it('falls back to the provided message when the body has no `message`', async () => {
    const response = jsonResponse({ something: 'else' }, 502);
    await expect(
      parseAirweaveResponse(response, 'Airweave is unavailable'),
    ).rejects.toThrow('Airweave is unavailable');
  });

  it('falls back when the body is not JSON', async () => {
    const response = new Response('not-json', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
    await expect(
      parseAirweaveResponse(response, 'oops'),
    ).rejects.toMatchObject({ status: 500, message: 'oops' });
  });
});
