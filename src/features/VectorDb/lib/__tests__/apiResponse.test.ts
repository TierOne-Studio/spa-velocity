import { describe, expect, it } from 'vitest';
import {
  VectorDbApiError,
  parseVectorDbResponse,
  requireVectorDbData,
} from '../apiResponse';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseVectorDbResponse', () => {
  it('unwraps the data envelope on 200', async () => {
    const response = jsonResponse({ data: { id: 'vdb-1' } });
    await expect(parseVectorDbResponse(response, 'fallback')).resolves.toEqual({
      id: 'vdb-1',
    });
  });

  it('returns undefined on 204 (typed as T | undefined)', async () => {
    const response = new Response(null, { status: 204 });
    await expect(
      parseVectorDbResponse<{ id: string }>(response, 'fallback'),
    ).resolves.toBeUndefined();
  });

  it('throws VectorDbApiError with the server message on non-2xx', async () => {
    const response = jsonResponse({ message: 'Nope' }, 409);
    await expect(parseVectorDbResponse(response, 'fallback')).rejects.toMatchObject({
      name: 'VectorDbApiError',
      status: 409,
      message: 'Nope',
    });
  });

  it('falls back to the provided message when the error body has no message', async () => {
    const response = new Response('not-json', { status: 500 });
    await expect(parseVectorDbResponse(response, 'fallback')).rejects.toMatchObject({
      name: 'VectorDbApiError',
      message: 'fallback',
    });
  });
});

describe('requireVectorDbData', () => {
  it('unwraps the data envelope like parseVectorDbResponse', async () => {
    const response = jsonResponse({ data: [{ id: 'vdb-1' }] });
    await expect(requireVectorDbData(response, 'fallback')).resolves.toEqual([
      { id: 'vdb-1' },
    ]);
  });

  it('throws VectorDbApiError when a data-bearing endpoint returns 204', async () => {
    const response = new Response(null, { status: 204 });
    await expect(requireVectorDbData(response, 'fallback')).rejects.toMatchObject({
      name: 'VectorDbApiError',
      status: 204,
    });
  });

  it('throws VectorDbApiError when the 2xx envelope has data: null', async () => {
    const response = jsonResponse({ data: null });
    await expect(requireVectorDbData(response, 'fallback')).rejects.toBeInstanceOf(
      VectorDbApiError,
    );
  });

  it('throws VectorDbApiError when the 2xx body lacks the data key', async () => {
    const response = jsonResponse({});
    await expect(requireVectorDbData(response, 'fallback')).rejects.toBeInstanceOf(
      VectorDbApiError,
    );
  });

  it('throws VectorDbApiError when the 2xx body is literal null', async () => {
    const response = jsonResponse(null);
    await expect(requireVectorDbData(response, 'fallback')).rejects.toBeInstanceOf(
      VectorDbApiError,
    );
  });

  it('throws VectorDbApiError when the 2xx body is invalid JSON', async () => {
    const response = new Response('not-json', { status: 200 });
    await expect(requireVectorDbData(response, 'fallback')).rejects.toBeInstanceOf(
      VectorDbApiError,
    );
  });
});
