/**
 * Strip Airweave portal `session_token=…` values from any rendered string.
 *
 * The OAuth-portal flow (see `useAirweaveOAuthPortal`) passes a session
 * token via URL parameter / fragment. If that URL ever lands in an error
 * toast, an unhandled-rejection log, or a console message, the token
 * leaks. This helper is the render-time presentation gate — call it on
 * any string that might contain a URL before passing to toast / console
 * / error UI.
 *
 * Matches both `?session_token=…` (query) and `#session_token=…` (fragment)
 * variants, plus `&session_token=…` inside multi-param URLs.
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
