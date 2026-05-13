# ADR-009: Asks-first dependency gate

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

Adding a new runtime dependency to a SPA carries permanent cost:

- Bundle size ships to every browser.
- Supply-chain risk (CVEs, account takeovers, package squatting).
- Maintenance debt (deprecated APIs, breaking releases).
- License surface (GPL/AGPL incompatibility in commercial code).
- Cognitive load (one more lib to keep up with).

Adding deps quietly — between commits, without explicit decision — accumulates these costs invisibly. The asymmetry is sharp: removing a dep that's spread across the codebase is far more expensive than adding it, and the pressure to keep it once it's adopted is real.

## Decision

The assistant MUST ask explicitly before adding any new entry to `package.json`'s `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`. The ask must include:

1. **Why** — what the dep delivers that the team can't easily roll.
2. **Bundle cost** — minified + gzipped size for runtime deps (bundlephobia / packagephobia citation).
3. **Alternatives** — at least one realistic alternative + why this one wins.
4. **License** — confirm MIT / Apache / BSD / equivalent permissive.
5. **Maintenance signal** — last commit / weekly downloads / known CVEs.
6. **Approach gate** — when the dep replaces a behavior pattern (e.g., a state library, a routing library, a forms library), explicitly state Approach A (this dep) vs Approach B (alternative or status-quo) and ask the user to choose.

After approval:
- Add the dep with the user's exact-version pinning preference.
- Run `npm audit` / equivalent post-install.
- Note the approval citation in the commit message body.

The `security-reviewer` subagent enforces this gate at review time: a diff with a new `dependencies` entry but no approval evidence in commit/PR history is a HIGH finding (CRITICAL for security-sensitive deps: auth, crypto, parsing untrusted input).

Transitive-only changes in `package-lock.json` (where `package.json` is unchanged) are NOT subject to the gate — they ride along normal npm install behavior. Note them but don't gate on them.

## Alternatives considered

- **Open dep policy** (no gate) — fastest in-the-moment, but bundle and supply chain bloat invisibly. Rejected.
- **Explicit allowlist of approved deps** — too rigid; legitimate new deps appear regularly. Rejected.
- **Deferred audit** (add now, audit at release) — by then the dep is entrenched and removing is costly. Rejected for asymmetric cost.

## Consequences

- **Positive:** every dep that lands has an explicit decision trail; bundle and supply chain stay intentional; audit trail in PR / commit history.
- **Negative:** small friction on each add. Worth it for the long-term hygiene.
- **Follow-ups:** if the gate becomes a frequent friction, automate the bundlephobia + license check via a CI step that posts a comment with the data — but the human decision still gates the merge.

## References

- [`bundle-size`](../../.ruler/skills/bundle-size/SKILL.md) § asks-first dep gate + audit checklist.
- [`security-reviewer`](../../.ruler/agents/security-reviewer.md) § Step 2.5 dependency-gate audit.
- CLAUDE.md P0 (approval-required operations).
