import { describe, expect, it } from 'vitest';
import { createEmbedSiteSchema, editEmbedSiteSchema } from '../embedSiteSchema';

describe('createEmbedSiteSchema', () => {
  it('accepts a valid create form', () => {
    const result = createEmbedSiteSchema.safeParse({
      name: 'Acme',
      projectId: 'proj-1',
      allowedOriginsText: 'https://acme.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing project', () => {
    const result = createEmbedSiteSchema.safeParse({
      name: 'Acme',
      projectId: '',
      allowedOriginsText: 'https://acme.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when no valid origin is present', () => {
    const result = createEmbedSiteSchema.safeParse({
      name: 'Acme',
      projectId: 'proj-1',
      allowedOriginsText: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a blank name', () => {
    const result = createEmbedSiteSchema.safeParse({
      name: '   ',
      projectId: 'proj-1',
      allowedOriginsText: 'https://acme.com',
    });
    expect(result.success).toBe(false);
  });
});

describe('editEmbedSiteSchema', () => {
  it('accepts name + origins + enabled', () => {
    const result = editEmbedSiteSchema.safeParse({
      name: 'Acme',
      allowedOriginsText: 'https://acme.com\nhttps://www.acme.com',
      enabled: false,
    });
    expect(result.success).toBe(true);
  });
});
