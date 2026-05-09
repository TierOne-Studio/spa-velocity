# ADR-007: better-auth + `localStorage.bearer_token` for auth

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

Auth-token storage is one of the most consequential security decisions in a SPA. Three commonly-considered options:

1. **httpOnly secure cookie** — protected from JS-side XSS, requires CSRF mitigations, requires same-domain or careful cross-origin/CORS setup.
2. **localStorage** — XSS-readable but cross-origin-friendly; relies on short token lifetimes, refresh-token discipline, and rigorous XSS prevention (no `dangerouslySetInnerHTML` without sanitizer, audited deps).
3. **In-memory** — most XSS-resistant, but lost on tab refresh; requires silent-refresh dance against the auth server.

The frontend uses **better-auth** as the auth client. better-auth's bearer-flow attaches the token as an `Authorization: Bearer ...` header; reading the token from a cookie would require server-side glue this SPA does not own.

Constraints:
- API requests are cross-origin (SPA at one domain, API at another).
- Auth server is better-auth-managed, not the SPA's responsibility to swap.
- Sign-out must work cross-tab (storage event).
- Session tokens are short-lived; refresh is handled by better-auth.

Visible in: [`src/shared/lib/auth-client.ts`](../../src/shared/lib/auth-client.ts), [`src/shared/context/AuthContext`](../../src/shared/context/AuthContext).

## Decision

We use **[better-auth](https://www.better-auth.com/)** with the **bearer-token flow stored in `localStorage` under the key `bearer_token`**. Token retrieval, attachment, refresh, and clearing on sign-out flow through better-auth's plugins (`organizationClient`, `adminClient`). We do **not** introduce a parallel token store, do **not** put the token in cookies, and do **not** roll our own auth client.

XSS is the primary mitigation responsibility: no `dangerouslySetInnerHTML` without a sanitizer (`react-markdown` default sanitizer, or DOMPurify); no third-party scripts without Subresource Integrity; `target="_blank"` always with `rel="noopener noreferrer"`; no `eval()` or equivalent on user input. See `frontend-security`.

## Alternatives considered

- **httpOnly cookie session** — would require BFF or auth server emitting a same-domain session cookie. Currently the SPA and API are different origins; switching to cookies would be a structural change requiring CORS/CSRF rework. Worth revisiting if the SPA gets a same-domain BFF.
- **In-memory only** — best XSS resistance, but every tab refresh kicks the user to a silent-refresh flow against better-auth that adds latency on every page load. Rejected for UX cost given current threat model.
- **Roll our own auth client** — repeated mistake across the industry. Rejected; better-auth is the canonical client.

## Consequences

- **Positive:** simple, works cross-origin, better-auth handles refresh + sign-out + cross-tab via storage events. No CSRF concerns (bearer-token via header).
- **Negative:** XSS in this SPA = session takeover until token expiry. Mitigation discipline is mandatory: every diff that touches HTML rendering, third-party scripts, env vars, or input handling triggers `security-reviewer`. The bar for `dangerouslySetInnerHTML` is high (sanitizer required + ADR if for trusted authors).
- **Follow-ups:** evaluate sliding to in-memory + silent refresh if the threat model changes (e.g., a known XSS class in a dep we can't replace). Evaluate same-domain BFF + httpOnly cookies if/when an API gateway is introduced.

## References

- [`src/shared/lib/auth-client.ts`](../../src/shared/lib/auth-client.ts) — `createAuthClient()` + plugins.
- [`src/shared/context/AuthContext`](../../src/shared/context/AuthContext).
- [`frontend-security`](../../.ruler/skills/frontend-security/SKILL.md) — XSS mitigation discipline.
- [`security-reviewer`](../../.ruler/agents/security-reviewer.md) — required on any diff touching this surface.
- [`repo-conventions`](../../.ruler/skills/repo-conventions/SKILL.md) § Auth.
