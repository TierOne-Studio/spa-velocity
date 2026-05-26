import { describe, expect, it } from 'vitest';
import { scrubSessionToken } from '../scrub-session-token';

describe('scrubSessionToken', () => {
  it('redacts query-string tokens (?session_token=…)', () => {
    expect(
      scrubSessionToken('https://app.airweave.ai/connect?session_token=abc123'),
    ).toBe('https://app.airweave.ai/connect?session_token=[REDACTED]');
  });

  it('redacts URL-fragment tokens (#session_token=…)', () => {
    expect(
      scrubSessionToken('https://app.airweave.ai/connect#session_token=abc123'),
    ).toBe('https://app.airweave.ai/connect#session_token=[REDACTED]');
  });

  it('redacts multi-param tokens (&session_token=…)', () => {
    expect(
      scrubSessionToken(
        'https://app.airweave.ai/connect?foo=1&session_token=abc123&bar=2',
      ),
    ).toBe(
      'https://app.airweave.ai/connect?foo=1&session_token=[REDACTED]&bar=2',
    );
  });

  it('redacts every occurrence in a long string', () => {
    const input =
      'first ?session_token=aaa second #session_token=bbb third &session_token=ccc';
    expect(scrubSessionToken(input)).toBe(
      'first ?session_token=[REDACTED] second #session_token=[REDACTED] third &session_token=[REDACTED]',
    );
  });

  it('leaves unrelated strings unchanged', () => {
    expect(scrubSessionToken('Failed to fetch')).toBe('Failed to fetch');
    expect(scrubSessionToken('Bearer xyz')).toBe('Bearer xyz');
    expect(scrubSessionToken('session_token=naked')).toBe('session_token=naked');
  });

  it('handles empty / falsy inputs', () => {
    expect(scrubSessionToken('')).toBe('');
  });

  it('is case-insensitive on the parameter name', () => {
    expect(
      scrubSessionToken('https://x/?Session_Token=abc'),
    ).toBe('https://x/?Session_Token=[REDACTED]');
  });
});
