import { describe, expect, it } from 'vitest';
import { createVectorDbSchema, updateVectorDbSchema } from '../vectorDbSchema';

describe.each([
  ['createVectorDbSchema', createVectorDbSchema],
  ['updateVectorDbSchema', updateVectorDbSchema],
] as const)('%s description', (_name, schema) => {
  it('normalizes an empty string to undefined', () => {
    const parsed = schema.parse({ name: 'Docs', description: '' });
    expect(parsed.description).toBeUndefined();
  });

  it('normalizes a whitespace-only string to undefined', () => {
    const parsed = schema.parse({ name: 'Docs', description: '   ' });
    expect(parsed.description).toBeUndefined();
  });

  it('keeps a real description, trimmed', () => {
    const parsed = schema.parse({ name: 'Docs', description: '  hello  ' });
    expect(parsed.description).toBe('hello');
  });

  it('accepts a missing description', () => {
    const parsed = schema.parse({ name: 'Docs' });
    expect(parsed.description).toBeUndefined();
  });

  it('rejects a description over 1000 characters', () => {
    const result = schema.safeParse({ name: 'Docs', description: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });

  it('accepts a description of exactly 1000 characters', () => {
    const parsed = schema.parse({ name: 'Docs', description: 'x'.repeat(1000) });
    expect(parsed.description).toHaveLength(1000);
  });

  it('still requires name', () => {
    const result = schema.safeParse({ name: '', description: 'hello' });
    expect(result.success).toBe(false);
  });
});
