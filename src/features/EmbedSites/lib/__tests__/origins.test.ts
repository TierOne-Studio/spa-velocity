import { describe, expect, it } from 'vitest';
import { isValidOrigin, parseOrigins } from '../origins';

describe('parseOrigins', () => {
  it('splits on newlines and commas, trims, and drops blanks', () => {
    expect(parseOrigins('https://a.com\n https://b.com , \n')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('dedupes preserving first-seen order', () => {
    expect(parseOrigins('https://a.com\nhttps://a.com\nhttps://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(parseOrigins('   \n , ')).toEqual([]);
  });
});

describe('isValidOrigin', () => {
  it.each([
    ['https://example.com', true],
    ['http://localhost:5173', true],
    ['https://example.com/', true],
    ['https://example.com/path', false],
    ['https://example.com?q=1', false],
    ['ftp://example.com', false],
    ['javascript:alert(1)', false],
    ['example.com', false],
    ['', false],
  ])('isValidOrigin(%s) === %s', (value, expected) => {
    expect(isValidOrigin(value)).toBe(expected);
  });
});
