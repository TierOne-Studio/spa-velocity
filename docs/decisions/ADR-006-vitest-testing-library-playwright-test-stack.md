# ADR-006: Vitest + Testing Library + Playwright as the test stack

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

Test infrastructure choice cascades through every feature: it dictates how fast the inner-loop runs, how reliable CI is, and what kind of regressions slip through. The team needs:
- Fast unit/component tests (Vite-native).
- Component testing with realistic DOM (jsdom or happy-dom).
- Accessibility-first queries that double as a11y checks.
- Cross-page e2e for auth, RBAC, multi-feature workflows.
- Deterministic CI runs (no retry-induced flake masking).

Visible in: [`vitest.config.ts`](../../vitest.config.ts), [`src/test/setup.ts`](../../src/test/setup.ts), [`playwright.config.ts`](../../playwright.config.ts), [`e2e/`](../../e2e/).

## Decision

We use **[Vitest 4](https://vitest.dev/)** for unit and component tests (jsdom environment, globals enabled, `setupFiles: ['./src/test/setup.ts']`). We use **[Testing Library](https://testing-library.com/)** (`@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`) with the query-priority order **role → label → placeholder → text → testId**. We use **[Playwright 1.57](https://playwright.dev/)** for cross-page workflows in `e2e/<module>/` (single Chromium project, no retries, deterministic). Test scripts split per module to map to feature folders (auth, admin, rbac, chat, admin-dashboard, dashboard, shared, api).

`*.test.ts(x)` for unit/component tests (co-located with the code). `*.spec.ts` for e2e specs in `e2e/`. Setup file mocks `window.matchMedia`, `ResizeObserver`, `IntersectionObserver` — required because jsdom doesn't provide them and Radix primitives use them.

## Alternatives considered

- **Jest** — established, but slower in this Vite repo (separate transformer pipeline) and the migration cost from Vitest would be regression risk. Rejected.
- **Cypress** (instead of Playwright) — strong DX, but slower, single-tab limitations, weaker multi-context support, and Playwright's parallelism + tracing has caught up. Rejected.
- **Snapshot-heavy tests** — brittle, change on every minor tweak, hide regressions in noise. Rejected as a pattern; Testing Library + behavioral assertions preferred.
- **No e2e** (rely on component tests + manual QA) — viable for very small apps; not for one with auth, RBAC, organizations, and multi-tenant flows. Rejected.

## Consequences

- **Positive:** Vitest is fast (Vite-native, ESM-first), Testing Library queries pull double duty as a11y checks, Playwright covers cross-page integration deterministically. Per-module e2e scripts allow targeted regression runs.
- **Negative:** Maintaining the test-setup mocks (matchMedia, ResizeObserver, IntersectionObserver) is small but real. e2e tests are slower than component tests — choose the lowest layer that proves the requirement (`react-testing` skill).
- **Follow-ups:** if test-suite runtime grows beyond CI budget, evaluate sharded e2e or selective test runs based on changed paths.

## References

- [`vitest.config.ts`](../../vitest.config.ts), [`src/test/setup.ts`](../../src/test/setup.ts).
- [`playwright.config.ts`](../../playwright.config.ts), [`e2e/`](../../e2e/).
- [`react-testing`](../../.ruler/skills/react-testing/SKILL.md) — query priority + layer selection.
- [`playwright-best-practices`](../../.ruler/skills/playwright-best-practices/SKILL.md) — e2e patterns.
- [`repo-conventions`](../../.ruler/skills/repo-conventions/SKILL.md) § Testing.
