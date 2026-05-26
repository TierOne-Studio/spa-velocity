/**
 * Strip Airweave `session_token=…` values from any rendered string.
 *
 * Per ADR-011 § Amendment 2: the official `@airweave/connect-react` SDK
 * transports the session token via postMessage (not URL), so URL-based
 * leakage is no longer a real attack surface. This helper is retained
 * as defense-in-depth on backend error messages — if a 4xx/5xx response
 * happens to embed `?session_token=xxx` (e.g., a malformed URL echoed
 * in the message body), we scrub it before render.
 *
 * Matches `?session_token=…`, `#session_token=…`, and `&session_token=…`
 * variants.
 *
 * Placed under `lib/` not `services/` because this is a security
 * presentation helper, not HTTP I/O. Reusable for future bearer-style URL
 * secrets — generalize the regex if/when a second secret name appears.
 */
const TOKEN_PATTERN = /([?#&]session_token=)[^&\s'"<>]+/gi;

export function scrubSessionToken(message: string): string {
  if (!message) return message;
  return message.replace(TOKEN_PATTERN, '$1[REDACTED]');
}
