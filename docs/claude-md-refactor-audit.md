# CLAUDE.md Distributed-Refactor — Audit (corrected after Phase 3)

This document records the starting state of `spa-velocity` and the classification of every existing artifact before the distributed refactor begins. It exists so nothing disappears silently and so each later phase has a fixed reference point.

Refactor target: bring `spa-velocity` to the same architectural shape as `api-velocity` — priority-ordered router + skills + subagents + ADRs + settings. Driver: [docs/claude-md-refactor-playbook-react-spa.md](claude-md-refactor-playbook-react-spa.md).

> **Note (Phase 3 correction).** The Phase-1 version of this document misreported the contents of `.ruler/skills/` and `.ruler/agents/` because the audit shell session had drifted into the sibling `api-velocity` repo when it ran `ls .ruler/`. This corrected version reflects what was actually in `spa-velocity`'s ruler tree at the start of the refactor. The Phase-1 commit (snapshots + audit doc) was kept as-is for paper trail; this correction is folded into Phase 3 alongside the duplicate cleanup and stale-skill drops.

## Critical context — `ruler` is the source of truth

`spa-velocity` uses [`@mravinale/ruler`](https://www.npmjs.com/package/@mravinale/ruler) (the user's own package) to propagate a single source of truth in `.ruler/` to multiple AI-tool config locations: `CLAUDE.md`, `.claude/skills/`, `.codex/skills/`, `.cursor/skills/`, `.github/copilot-instructions.md`, `AGENTS.md`. All of those are gitignored as ruler-generated outputs. Every change must land in `.ruler/`.

## Actual `.ruler/` state at the start of the refactor

| Path | State | Notes |
|---|---|---|
| `.ruler/instructions.md` | 390 lines, ~17.6 KB, **already React-SPA-flavored** | Header: "SOFTWARE DEVELOPMENT OPERATIONS — RLM ENGINEER (REACT SPA)". This is the source for the current `CLAUDE.md`. Snapshot kept at `.ruler/instructions.md.pre-refactor.bak`. |
| `.ruler/skills/` | **86 entries: 51 unique skills + 35 ` copy` Finder duplicates** | Catalog described below. **No process/doctrine skills present** (no `tdd-workflow`, `design-review`, `plan-mode`, `repo-conventions`, `failure-mode-analysis`, `bug-investigation`, etc.). |
| `.ruler/agents/` | does not exist | Subagents must be added from scratch. |
| `.ruler/tests/` | does not exist | Acceptance scripts will be added later if needed. |
| `.ruler/ruler.toml` | 51 lines | Configures Copilot / Claude / Codex / Cursor / Windsurf as output targets; `[skills] enabled = true`; no `[agents]` section. |

### Ruler skills inventory (51 unique)

**Patterns.dev catalog (44):** `ai-ui-patterns`, `bundle-splitting`, `client-side-rendering`, `command-pattern`, `compound-pattern`, `compression`, `dynamic-import`, `factory-pattern`, `flyweight-pattern`, `hoc-pattern`, `hooks-pattern`, `import-on-interaction`, `import-on-visibility`, `incremental-static-rendering`, `islands-architecture`, `js-performance-patterns`, `loading-sequence`, `mediator-pattern`, `mixin-pattern`, `module-pattern`, `observer-pattern`, `prefetch`, `preload`, `presentational-container-pattern`, `progressive-hydration`, `prototype-pattern`, `provider-pattern`, `proxy-pattern`, `prpl`, `react-2026`, `react-composition-2026`, `react-data-fetching`, `react-render-optimization`, `react-selective-hydration`, `render-props-pattern`, `route-based`, `singleton-pattern`, `static-import`, `streaming-ssr`, `third-party`, `tree-shaking`, `view-transitions`, `virtual-lists`, `vite-bundle-optimization`.

**SPA tooling skills (5):** `vite`, `vitest`, `shadcn`, `tailwind-v4-shadcn`, `playwright-best-practices`.

**Universal skills (2):** `code-simplifier`, `typescript-advanced-types`.

(Note: `js-performance-patterns` straddles "patterns.dev" and "universal" categories — kept either way.)

## Stack discovered

- **Build**: Vite 7, TypeScript 5.8 (strict)
- **UI**: React 19, React Router 7, Radix primitives, Tailwind 4, `class-variance-authority`, `tailwind-merge`, `next-themes`, `sonner`
- **State**: Zustand 5 (with `immer`) for client; TanStack Query 5 for server state
- **Forms**: React Hook Form 7 + Zod 4 + `@hookform/resolvers`
- **Auth**: `better-auth` (token in `localStorage.bearer_token`)
- **Test**: Vitest 4 + Testing Library + `user-event` + jsdom; Playwright 1.57 (Chromium)
- **HTTP**: axios for non-auth endpoints; `better-auth` client for auth surface

## Phase 3 cleanup (this commit)

### Removed: 35 ` copy` duplicates

Finder-style duplicates left from manual file ops. Removed: `bundle-splitting copy`, `command-pattern copy`, `compression copy`, `dynamic-import copy`, `factory-pattern copy`, `flyweight-pattern copy`, `import-on-interaction copy`, `import-on-visibility copy`, `islands-architecture copy`, `js-performance-patterns copy`, `loading-sequence copy`, `mediator-pattern copy`, `mixin-pattern copy`, `module-pattern copy`, `observer-pattern copy`, `playwright-best-practices copy`, `prefetch copy`, `preload copy`, `prototype-pattern copy`, `provider-pattern copy`, `proxy-pattern copy`, `prpl copy`, `route-based copy`, `shadcn copy`, `singleton-pattern copy`, `static-import copy`, `tailwind-v4-shadcn copy`, `third-party copy`, `tree-shaking copy`, `typescript-advanced-types copy`, `view-transitions copy`, `virtual-lists copy`, `vite copy`, `vite-bundle-optimization copy`, `vitest copy`.

### Removed: 29 patterns.dev skills (14 MERGE + 13 STALE + 2 DEPRECATED)

Recovery is a `git revert` away. Recoverable from git history.

| Skill | Bucket | Replacement |
|---|---|---|
| `bundle-splitting` | MERGE | `react-performance` / `bundle-size` (Phase 4) |
| `dynamic-import` | MERGE | `react-performance` |
| `import-on-interaction` | MERGE | `react-performance` |
| `import-on-visibility` | MERGE | `react-performance` |
| `route-based` | MERGE | `react-routing` |
| `compression` | MERGE | `bundle-size` |
| `tree-shaking` | MERGE | `bundle-size` |
| `vite-bundle-optimization` | MERGE | `bundle-size` (the existing `vite` skill stays) |
| `loading-sequence` | MERGE | `react-performance` |
| `prefetch` | MERGE | `react-performance` |
| `preload` | MERGE | `react-performance` |
| `third-party` | MERGE | `frontend-security` / `react-performance` |
| `virtual-lists` | MERGE | `react-performance` |
| `static-import` | MERGE | `bundle-size` |
| `command-pattern` | STALE | — (generic GoF) |
| `factory-pattern` | STALE | — |
| `flyweight-pattern` | STALE | — |
| `observer-pattern` | STALE | — (superseded by Context / store / event emitters) |
| `singleton-pattern` | STALE | — (anti-pattern in modern React) |
| `mediator-pattern` | STALE | — (superseded by store architectures) |
| `prototype-pattern` | STALE | — (ES classes dominate) |
| `client-side-rendering` | STALE | — (assumed in SPA context) |
| `incremental-static-rendering` | OUT-OF-SCOPE | — (meta-framework only) |
| `islands-architecture` | OUT-OF-SCOPE | — |
| `progressive-hydration` | OUT-OF-SCOPE | — |
| `streaming-ssr` | OUT-OF-SCOPE | — |
| `react-selective-hydration` | OUT-OF-SCOPE | — |
| `view-transitions` | DEPRECATED | — (web-API reference, not a pattern) |
| `prpl` | DEPRECATED | — (superseded by Core Web Vitals framing) |

### `.ruler/skills/` after Phase 3 cleanup: 22 skills

KEEP (8): `ai-ui-patterns`, `compound-pattern`, `presentational-container-pattern`, `provider-pattern`, `react-2026`, `react-composition-2026`, `react-data-fetching`, `react-render-optimization`.

REWRITE-DESC (6): `hoc-pattern`, `hooks-pattern`, `mixin-pattern`, `module-pattern`, `proxy-pattern`, `render-props-pattern` — descriptions sharpened in Phase 4.

SPA tooling (5): `vite`, `vitest`, `shadcn`, `tailwind-v4-shadcn`, `playwright-best-practices`.

Universal (3): `code-simplifier`, `typescript-advanced-types`, `js-performance-patterns`.

## Remaining phase plan

| Phase | Goal | Net `.ruler/skills/` count after |
|---|---|---|
| 4 | Add **14 universal process skills** (port from api-velocity: `tdd-workflow`, `design-review`, `plan-mode`, `failure-mode-analysis`, `bug-investigation`, `rlm-explore`, `decision-rules`, `pushback-templates`, `git-workflow`, `documentation-and-adrs`, `cyclomatic-complexity`, `meta-skill-hygiene`, `async-error-handling`, `nodejs-best-practices`-replacement-or-skip). Add **9 React-stack skills** (`react-patterns`, `react-state-management`, `react-performance`, `react-routing`, `react-forms`, `react-testing`, `accessibility`, `frontend-security`, `bundle-size`). Rewrite descriptions on the 6 REWRITE-DESC skills. | 45 |
| 5 | Add `repo-conventions` (write fresh, grounded in spa-velocity facts). | 46 |
| 6 | Create `.ruler/agents/` and add the 5 subagents (`architect-reviewer`, `code-reviewer`, `qa-validator`, `security-reviewer`, `lessons-curator`) — write SPA-flavored bodies. | — |
| 7 | Create `docs/decisions/` with `_template.md`, `README.md`, and ~10 ADRs. | — |
| 8 | Rewrite `.ruler/instructions.md` as the priority-ordered router (P0–P9 + Skill Pointers + Workflow Chains, strict 5×0.20 rubric, P3.4 force-load incl. `accessibility`, P5 read-memory + P7 reflexive-capture). Run `npx ruler apply`. Smoke test. | — |

## Subagents — gap

`.ruler/agents/` does not exist. Phase 6 creates it and adds all 5 subagents from scratch.

## Settings hardening — done in Phase 2

`deny` (mechanical): main/master writes (every form), `--force` pushes, `git rebase -i main`, `git reset --hard`, `git clean -fd/-fdx`, `npm publish` family, `vercel deploy`, `netlify deploy`, `gh-pages -d`, `gh release` writes.

`ask`: `gh pr` writes, `gh issue` writes, `gh repo create/delete`, `npm version`, `npm install --save*`, `npm uninstall`, `rm -rf:*`.

## ADR plan (`docs/decisions/`, Phase 7)

1. State management library (Zustand)
2. Server-state library (TanStack Query)
3. Routing library (React Router 7)
4. Styling system (Tailwind 4 + Radix + CVA)
5. Form library (RHF + Zod)
6. Test stack (Vitest + Testing Library + Playwright)
7. Auth-token storage (better-auth + `localStorage.bearer_token`) — load-bearing because it sets the XSS attack surface
8. No AI-attribution trailers (port verbatim from api-velocity ADR-008)
9. Asks-first dependency gate (port verbatim from api-velocity ADR-006)
10. Skill-vs-repo conflict resolution (port verbatim from api-velocity ADR-007)
