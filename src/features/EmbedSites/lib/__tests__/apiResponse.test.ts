import { describe, expect, it } from 'vitest';
import {
  EmbedSiteApiError,
  parseEmbedSiteResponse,
  requireEmbedSiteData,
} from '../apiResponse';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('parseEmbedSiteResponse', () => {
  it('returns the unwrapped data on a well-formed envelope', async () => {
    const data = await parseEmbedSiteResponse<{ id: string }>(
      jsonResponse({ data: { id: 'site-1' } }),
      'failed',
    );
    expect(data).toEqual({ id: 'site-1' });
  });

  it('returns undefined on 204 (no content)', async () => {
    const data = await parseEmbedSiteResponse(
      new Response(null, { status: 204 }),
      'failed',
    );
    expect(data).toBeUndefined();
  });

  it('throws when a 2xx body omits the data property (contract violation)', async () => {
    await expect(
      parseEmbedSiteResponse(jsonResponse({}), 'failed'),
    ).rejects.toBeInstanceOf(EmbedSiteApiError);
  });

  it('throws with the server message on a non-ok response', async () => {
    await expect(
      parseEmbedSiteResponse(jsonResponse({ message: 'nope' }, 403), 'failed'),
    ).rejects.toMatchObject({ status: 403, message: 'nope' });
  });
});

describe('requireEmbedSiteData', () => {
  it('returns the data on a well-formed envelope', async () => {
    const data = await requireEmbedSiteData<{ id: string }>(
      jsonResponse({ data: { id: 'site-1' } }),
      'failed',
    );
    expect(data).toEqual({ id: 'site-1' });
  });

  it('throws when the envelope data is null (empty 2xx is a server bug)', async () => {
    await expect(
      requireEmbedSiteData(jsonResponse({ data: null }), 'failed'),
    ).rejects.toBeInstanceOf(EmbedSiteApiError);
  });

  it('throws on a 204 (no body where one is contractually required)', async () => {
    await expect(
      requireEmbedSiteData(new Response(null, { status: 204 }), 'failed'),
    ).rejects.toBeInstanceOf(EmbedSiteApiError);
  });
});
