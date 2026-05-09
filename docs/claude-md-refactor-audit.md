# CLAUDE.md Distributed-Refactor — Phase 1 Audit

This document records the starting state of `spa-velocity` and the classification of every existing artifact before the distributed refactor begins. It exists so nothing disappears silently and so each later phase has a fixed reference point.

Refactor target: bring `spa-velocity` to the same architectural shape as `api-velocity` — priority-ordered router + skills + subagents + ADRs + settings. Driver: [docs/claude-md-refactor-playbook-react-spa.md](claude-md-refactor-playbook-react-spa.md).

## Critical discovery — `ruler` is the source of truth

`spa-velocity` uses [`@mravinale/ruler`](https://www.npmjs.com/package/@mravinale/ruler) (the user's own package) to propagate a single source of truth in `.ruler/` to multiple AI-tool config locations: `CLAUDE.md`, `.claude/skills/`, `.codex/skills/`, `.cursor/skills/`, `.github/copilot-instructions.md`, `AGENTS.md`. All of those are gitignored as ruler-generated outputs.

**Implication for this refactor:** every change must land in `.ruler/`, not in the generated outputs. The generated `.claude/skills/` and `CLAUDE.md` are working-tree artifacts only; they are recreated by `npx ruler apply` from the canonical sources.

### Ruler state at the start of this refactor

`.ruler/` is **already partially aligned with `api-velocity`** — it was seeded from there and most structural pieces exist:

| Path | Count | Origin | Notes |
|---|---|---|---|
| `.ruler/instructions.md` | 1 (324 lines) | api-velocity-flavored prose | NestJS / RBAC / TypeORM / scope contract content. Snapshot: `.ruler/instructions.md.pre-refactor.bak`. |
| `.ruler/skills/` | 23 | identical to api-velocity catalog | `tdd-workflow`, `design-review`, `plan-mode`, `repo-conventions`, `failure-mode-analysis`, `bug-investigation`, `rlm-explore`, `decision-rules`, `pushback-templates`, `git-workflow`, `documentation-and-adrs`, `code-simplifier`, `cyclomatic-complexity`, `meta-skill-hygiene`, `async-error-handling`, `typescript-advanced-types`, `js-performance-patterns`, `nodejs-best-practices`, `nestjs-best-practices`, `nestjs-clean-architecture`, `nestjs-patterns`, `database-transactions`, `db-write-protocol`. |
| `.ruler/agents/` | 5 | identical to api-velocity | `architect-reviewer`, `code-reviewer`, `qa-validator`, `security-reviewer`, `lessons-curator`. Bodies still NestJS-flavored. |
| `.ruler/tests/` | 2 | identical | `run-acceptance.sh`, `simulate-prompts.sh`. |
| `.ruler/ruler.toml` | 1 | repo-specific | Configures Copilot / Claude / Codex / Cursor / Windsurf as output targets. |

### Outside-of-ruler state at start

| Path | Count | Origin | Treatment |
|---|---|---|---|
| `CLAUDE.md` | 1 (2,761 words) | ruler-generated | Snapshot: `CLAUDE.md.pre-refactor.bak`. Will be regenerated from new `.ruler/instructions.md`. |
| `.claude/skills/` | 45 | **NOT from ruler** — patterns.dev catalog cloned in separately | Gitignored. Most don't exist in `.ruler/skills/`, so `ruler apply` would wipe them. The 16 KEEP-classified ones below are being ported into `.ruler/skills/`. |
| `.claude/agents/` | 0 | empty | Will be regenerated from `.ruler/agents/`. |
| `.claude/settings.json` | 1 | tracked outside ruler | `allow`-only allowlist. Phase 2 will add `deny`/`ask` gates. |
| `docs/decisions/` | — | does not exist | Phase 7 creates ADRs here. |
| Memory | wired | `~/.claude/projects/<encoded>/memory/MEMORY.md` | Phase 8 wires P5 read / P7 write into router. |

## Stack discovered

- **Build**: Vite 7, TypeScript 5.8 (strict)
- **UI**: React 19, React Router 7, Radix primitives, Tailwind 4, `class-variance-authority`, `tailwind-merge`, `next-themes`, `sonner`
- **State**: Zustand 5 (with `immer`) for client; TanStack Query 5 for server state
- **Forms**: React Hook Form 7 + Zod 4 + `@hookform/resolvers`
- **Auth**: `better-auth` (token in `localStorage.bearer_token`)
- **Test**: Vitest 4 + Testing Library + `user-event` + jsdom; Playwright 1.57 (Chromium)
- **HTTP**: axios for non-auth endpoints; `better-auth` client for auth surface

## Skill audit — what stays, what changes, what's added

### `.ruler/skills/` — DROP from existing 23 (irrelevant on a SPA)

| Skill | Why dropped |
|---|---|
| `nestjs-best-practices` | NestJS-only |
| `nestjs-clean-architecture` | NestJS-only |
| `nestjs-patterns` | NestJS-only |
| `nodejs-best-practices` | Server-runtime focus; SPA uses browser runtime |
| `database-transactions` | No DB writes from a SPA |
| `db-write-protocol` | No DB writes from a SPA |

Net after drops: **17 universal skills** stay in `.ruler/skills/`.

### `.ruler/skills/` — KEEP (17 from api-velocity port)

`tdd-workflow`, `design-review`, `plan-mode`, `repo-conventions` (rewrite body for spa-velocity), `failure-mode-analysis`, `bug-investigation`, `rlm-explore`, `decision-rules`, `pushback-templates`, `git-workflow`, `documentation-and-adrs`, `code-simplifier`, `cyclomatic-complexity`, `meta-skill-hygiene`, `async-error-handling`, `typescript-advanced-types`, `js-performance-patterns`.

### `.ruler/skills/` — ADD (9 new React-stack)

`react-patterns`, `react-state-management`, `react-performance`, `react-routing`, `react-forms`, `react-testing`, `accessibility`, `frontend-security`, `bundle-size`.

### `.ruler/skills/` — PORT from `.claude/skills/` patterns.dev catalog (KEEP-bucket)

These have no equivalent in api-velocity but are useful in this React SPA. They get folded into `.ruler/skills/` so they survive `ruler apply`:

`react-2026`, `react-composition-2026`, `react-data-fetching` (rewrite to cite `repo-conventions`), `react-render-optimization` (cite `react-performance`), `ai-ui-patterns`, `compound-pattern`, `presentational-container-pattern`, `provider-pattern`. Plus 6 with description rewrites: `hooks-pattern`, `hoc-pattern`, `render-props-pattern`, `module-pattern`, `mixin-pattern`, `proxy-pattern`.

That's **14 patterns.dev skills carried forward into `.ruler/skills/`**.

### `.claude/skills/` patterns.dev catalog — DROP (29)

Not ported to `.ruler/`. Cease to exist after `ruler apply`. Recovery via git history if ever needed.

- 14 MERGE — content folded into the new stack skills (`bundle-splitting`, `dynamic-import`, `import-on-interaction`, `import-on-visibility`, `route-based`, `compression`, `tree-shaking`, `vite-bundle-optimization`, `loading-sequence`, `prefetch`, `preload`, `third-party`, `virtual-lists`, `static-import`)
- 13 STALE — generic GoF / SSR / hybrid-meta-framework patterns that don't fire on a pure SPA stack (`command-pattern`, `factory-pattern`, `flyweight-pattern`, `observer-pattern`, `singleton-pattern`, `mediator-pattern`, `prototype-pattern`, `client-side-rendering`, `incremental-static-rendering`, `islands-architecture`, `progressive-hydration`, `streaming-ssr`, `react-selective-hydration`)
- 2 DEPRECATED — `view-transitions` (web-API reference, not a pattern), `prpl` (superseded by Core Web Vitals framing)

### Final `.ruler/skills/` count after refactor: **40**

(17 universal + 9 react-stack + 14 ported patterns.dev = 40.)

## Subagents — adapt all 5

`.ruler/agents/` already has the 5 files. Bodies are NestJS-flavored. Phase 6 rewrites bodies for SPA concerns:

- `architect-reviewer` — state-lib boundaries, error-boundary placement, code-splitting decisions, prop-drilling-vs-context-vs-store calls
- `code-reviewer` — same SOLID/DRY/KISS/SoC mandate, no body change to mandate, just frontend examples
- `qa-validator` — Testing Library priority order, axe a11y checks, MSW handler completeness, E2E coverage for critical paths
- `security-reviewer` — XSS sinks (`dangerouslyInnerHTML`, `react-markdown` configuration), `VITE_*` env-var leakage, `localStorage.bearer_token` audit, postMessage/iframe origins, dependency `npm audit`
- `lessons-curator` — unchanged (read-only proposer)

## ADR plan (`docs/decisions/`, Phase 7)

Likely 9–10 ADRs:

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

## Settings hardening (`.claude/settings.json`, Phase 2)

`deny` (mechanical hard-fail):
- `git push` to `main` / `master`
- `git push --force` (any branch)
- `npm publish`

`ask` (require approval):
- `git commit`, `git push`, `gh pr create`, `gh pr merge`, `gh pr close`
- `npm version`, `vercel deploy`, `netlify deploy`

## Phase plan (revised after ruler discovery)

1. **Phase 1** (this commit) — Audit + ruler discovery + snapshots (`.ruler/instructions.md.pre-refactor.bak`, `CLAUDE.md.pre-refactor.bak`).
2. **Phase 2** — `.claude/settings.json` `deny`/`ask` gates.
3. **Phase 3** — `.ruler/skills/`: drop the 6 NestJS/Node skills; keep the 17 universal ones (no edits needed for now).
4. **Phase 4** — `.ruler/skills/`: add 9 React-stack skills + port the 14 patterns.dev KEEP/REWRITE-DESC ones.
5. **Phase 5** — Rewrite `.ruler/skills/repo-conventions/SKILL.md` body for spa-velocity (concrete folder/state/routing/test conventions).
6. **Phase 6** — Rewrite the 5 `.ruler/agents/*.md` bodies for SPA concerns.
7. **Phase 7** — Create `docs/decisions/` (template + README + ~10 ADRs).
8. **Phase 8** — Rewrite `.ruler/instructions.md` as the priority-ordered router (P0–P9 + Skill Pointers + Workflow Chains, strict 5×0.20 rubric, P3.4 force-load incl. `accessibility`, P5 read-memory + P7 reflexive-capture). Run `npx ruler apply`. Smoke test.

Single PR, one commit per phase.
