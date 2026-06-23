// Allowed-origins are edited as free text (one per line or comma-separated) and
// normalized to a deduped string[] for the API. Validation is fail-fast at the
// form boundary so a malformed origin never round-trips to the server.

/** Split on newlines/commas, trim, drop blanks, dedupe (first-seen order). */
export function parseOrigins(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const origin = raw.trim();
    if (origin && !seen.has(origin)) {
      seen.add(origin);
      result.push(origin);
    }
  }
  return result;
}

/** A valid embed origin is an http(s) scheme + host with no path/query/hash. */
export function isValidOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === ''
  );
}
