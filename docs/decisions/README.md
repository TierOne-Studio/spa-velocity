# Architecture Decision Records (ADRs)

Canonical *why* for spa-velocity's load-bearing engineering decisions. Skills and `CLAUDE.md` cite ADRs by number; they do not restate rationales. See [`documentation-and-adrs`](../../.ruler/skills/documentation-and-adrs/SKILL.md) for the format and the citation flow.

Append-only. Don't edit accepted ADRs except to update Status (Accepted → Superseded by ADR-XXX). The next ADR explains why.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [ADR-001](ADR-001-zustand-for-client-state.md) | Zustand for app-wide client state | Accepted | 2026-05-09 |
| [ADR-002](ADR-002-tanstack-query-for-server-state.md) | TanStack Query for server state | Accepted | 2026-05-09 |
| [ADR-003](ADR-003-react-router-7-for-routing.md) | React Router 7 for routing | Accepted | 2026-05-09 |
| [ADR-004](ADR-004-tailwind-4-radix-cva-for-styling.md) | Tailwind 4 + Radix primitives + CVA for styling | Accepted | 2026-05-09 |
| [ADR-005](ADR-005-react-hook-form-zod-for-forms.md) | React Hook Form + Zod for forms | Accepted | 2026-05-09 |
| [ADR-006](ADR-006-vitest-testing-library-playwright-test-stack.md) | Vitest + Testing Library + Playwright as the test stack | Accepted | 2026-05-09 |
| [ADR-007](ADR-007-better-auth-localstorage-bearer-token.md) | better-auth + `localStorage.bearer_token` for auth | Accepted | 2026-05-09 |
| [ADR-008](ADR-008-no-ai-attribution-in-commits.md) | No AI-attribution trailers in commits, PRs, or issues | Accepted | 2026-05-09 |
| [ADR-009](ADR-009-asks-first-dependency-gate.md) | Asks-first dependency gate | Accepted | 2026-05-09 |
| [ADR-010](ADR-010-skill-vs-repo-conflict-resolution.md) | Skill-vs-repo conflict resolution | Accepted | 2026-05-09 |
| [ADR-011](ADR-011-spec-first-documentation-workflow.md) | Specification-first documentation workflow | Accepted | 2026-06-04 |

## Adding an ADR

1. Confirm the decision is load-bearing: would changing it require updating 3+ skills/docs/files? If yes → ADR.
2. `cp docs/decisions/_template.md docs/decisions/ADR-NNN-<short-kebab-title>.md` where NNN is the next available number.
3. Fill it in. Be specific. Avoid hedge words.
4. Add a row to the table above.
5. Update the citation surface — any skill that previously contained the rationale gets shortened to cite the ADR (`Per ADR-NNN, ...`). The router (`CLAUDE.md`) NEVER cites ADRs (per the layered-router principle in `documentation-and-adrs`).
6. Commit: `docs(adr): ADR-NNN <title>`. ADRs do not need TDD.

## Superseding an ADR

1. Mark the existing ADR's Status: `Superseded by ADR-XXX`. Do not delete or rewrite the body.
2. Write the new ADR. Include `Supersedes ADR-NNN` in its References + a Context note explaining what changed.
3. Update the citation surface.
4. Commit: `docs(adr): ADR-XXX supersedes ADR-NNN — <reason>`.
