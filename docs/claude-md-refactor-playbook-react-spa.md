# CLAUDE.md Distributed-Refactor Playbook — React SPA Edition

**Audience:** an LLM tasked with bringing a React SPA repo into the same architectural shape as `api-velocity` — distributed CLAUDE.md (router) + skills + subagents + ADRs + settings + memory.

**Repo's starting state (assumed):**
- Has a monolithic CLAUDE.md that's too big.
- Has *some* skills already in `.claude/skills/`.
- Has **no** subagents in `.claude/agents/`.
- React SPA stack (Vite/Webpack/CRA + React + likely TS + a router + a state lib + a data-fetching lib + a styling system + a test runner).

**Target end state:**
```
CLAUDE.md                              # ~3,000-word priority-ordered router
.claude/
  settings.json                        # permission gates (deny main writes, ask on git push)
  skills/
    <existing skills, audited>         # keep what fits, prune what doesn't
    <new universal skills>             # tdd-workflow, design-review, plan-mode, ...
    <react-stack skills>               # react-patterns, react-state-mgmt, ...
    repo-conventions/SKILL.md          # the grounding skill — write from scratch
  agents/
    architect-reviewer.md              # all 5 are new — port from api-velocity
    code-reviewer.md
    qa-validator.md
    security-reviewer.md
    lessons-curator.md
docs/
  decisions/
    0001-<slug>.md                     # one ADR per load-bearing frontend decision
    ...
```

This playbook is **self-contained** — feed it to an LLM along with the target repo's current `CLAUDE.md` and the LLM has enough to execute.

---

## Reference: what the source PR (api-velocity) actually did

For calibration, the source refactor produced:
- **23 skills** (folder-per-skill, `SKILL.md` with YAML frontmatter)
- **5 subagents** (single-file `.md` with `tools:` frontmatter line)
- **9 ADRs** in `docs/decisions/` + `_template.md` + `README.md`
- **CLAUDE.md** at 3,288 words, priority-ordered P0–P9 + Skill Pointers + Workflow chains
- **`.claude/settings.json`** with `deny`/`ask` permission gates
- **Acceptance test scripts** in `.claude/tests/` to validate skill loading
- **14 commits** done in reviewable order (archive monolith → settings → universal skills → repo-conventions → stack skills → subagents → ADRs → router → memory wiring → validate)

Total scope: ~22.8k insertions across 97 files. Plan for similar order-of-magnitude on a comparable React repo.

---

## Architectural decisions to preserve from the source PR

These are non-negotiable — they're what makes the system work, not stylistic choices:

1. **Priority-ordered router** with MUST/SHOULD/MAY language. P0 (safety) overrides everything.
2. **P3.4 mandatory skill invocation table** — doctrine-critical skills MUST fire even if their `description` didn't auto-trigger (description-trigger is unreliable).
3. **P3.5 skill-vs-repo conflict resolution** — when a generic skill conflicts with `repo-conventions`, follow the skill *unless* applying it would require structural changes outside the PR's scope.
4. **Adversarial subagents with single-concern ownership** — `code-reviewer` does design only; `qa-validator` does coverage only; `security-reviewer` does security only. **No overlap.** Each willing to BLOCK.
5. **5×0.20 confidence rubric** — tests pass / principles checked / no HIGH issues / domain gates / no open assumptions. < 0.90 → revise weakest area.
6. **Subagent confidence aggregation via `min()`, not average** — weakest signal sets the ceiling. BLOCK from any subagent → final 0.
7. **ADRs cite, skills/CLAUDE.md don't restate** — load-bearing decisions get one canonical home. Test: would changing the rule require updating 3+ docs? Yes → ADR.
8. **`repo-conventions` is the highest-leverage skill** — it's what makes the system *grounded* instead of *generic*. Always-fire on code work in that repo.
9. **Memory loop** — P5 reads feedback memories first; P7 captures corrections unconditionally to `~/.claude/projects/<encoded>/memory/`.
10. **`Skills consulted:` self-attestation** in P8 output contract — visibility into which skills actually loaded.

---

## Phase 0 — Audit existing state (DO THIS FIRST)

Before changing anything, produce a written audit. The repo already has skills, so you can't just dump the api-velocity catalog over them.

### 0.1 Read the current monolith

Read the existing `CLAUDE.md` end-to-end. Note:
- All MUST/SHOULD rules (these are doctrine — none can disappear silently).
- Permission gates (DB? deploy? git? attribution?).
- Stack-specific facts (build tool, state lib, router, test runner, styling).
- Repo-specific conventions (folder layout, naming, error handling).
- Anything that looks like an ADR-worthy rationale.

### 0.2 Inventory existing skills

For each skill in `.claude/skills/`:
- Read `SKILL.md`. Note name, description, body length.
- Classify: **universal doctrine** (TDD, design-review, plan-mode), **stack-specific** (React, TS), **repo-specific** (this codebase only), or **stale/duplicate**.
- Flag conflicts with the universal set this playbook will install.

### 0.3 Stack discovery

Read `package.json`, `tsconfig.json`, `vite.config.*`/`webpack.config.*`/CRA config, the README, and 2–3 source files. Identify:
- Build tool: Vite | Webpack | Next.js | Remix | CRA (deprecated)
- Router: React Router | TanStack Router | Next.js routing
- State: Zustand | Redux Toolkit | Jotai | Recoil | Context-only | TanStack Query (server state) | Apollo (GraphQL)
- Styling: CSS Modules | Tailwind | styled-components | Emotion | vanilla-extract
- Testing: Vitest | Jest | Testing Library | Playwright | Cypress
- Forms: React Hook Form | Formik | none
- Type system: TS strict? Any `any` linter rules?

### 0.4 Permission surface

List operations that should require explicit user approval:
- `git push`, `git commit`, branch creation, PR creation
- Deploy commands (`vercel deploy`, `netlify deploy`, `gh-pages`)
- `npm publish` if the repo publishes packages
- Any script that touches production env

**Output of Phase 0:** a one-page audit. Without it, every later phase is guessing.

---

## Phase 1 — The router skeleton (CLAUDE.md)

Write the new CLAUDE.md as ~3,000 words, priority-ordered. **Do not extract doctrine yet** — write the structure first, then fill in.

### Required sections (in order)

```
P0 — Safety & Permissions           (NON-NEGOTIABLE; overrides everything)
P1 — Identity & Role                (senior frontend engineer, language, register)
P2 — Repo-Core Conventions          (one-paragraph pointer to repo-conventions skill)
P3 — Code-Change Defaults           (TDD applies, design-review applies, waiver phrases)
P4 — Mandatory Verification         (subagent gates: 3+ files, auth/PII/public API)
P5 — Operating Mindset              (scope, surgery, root-cause, fail-fast, plan-mode default)
P6 — Decision Rules & Pushback      (defaults under ambiguity)
P7 — Reflexive Lesson Capture       (memory loop after corrections)
P8 — Output Contract                (deliverables + 5×0.20 confidence rubric)
P9 — Style & Defaults               (typing, errors, logging)

Skill Pointers                      (situation → skill lookup table)
Workflow chains                     (task type → skill+subagent recipe)
```

### Frontend-specific permission rules for P0

```
- main is off-limits (deny in settings.json)
- Git/GitHub writes need approval (commit, push, PR, merge, force, tag)
- Deploy commands need approval (vercel deploy, netlify deploy, npm publish)
- No AI-attribution trailers (no Co-Authored-By Claude, no "🤖 Generated with")
```

There's no DB write protocol on a pure SPA. If the repo has a BFF or API routes (Next.js, Remix), include the DB rule.

### Frontend-specific P3.4 force-load list

These skills MUST fire on every executable-code change in a React repo, even if `description` didn't auto-trigger:

| Skill | Always fire when |
|---|---|
| `tdd-workflow` | Any executable-code change |
| `failure-mode-analysis` | Non-trivial change, BEFORE the failing test |
| `repo-conventions` | Any code change in this repo |
| `design-review` | Before declaring complete |
| `plan-mode` | 3+ steps OR multi-file OR architectural |
| `react-patterns` | Any change touching components, hooks, or rendering |
| `accessibility` | Any change touching UI markup or interactive elements |

### Frontend-specific P4 verification gate

Subagents fire when:
- **3+ files** changed → `code-reviewer` + `qa-validator`
- **Architectural change** (new state lib, new routing pattern, new global provider) → `architect-reviewer` pre-impl
- **High-risk surfaces** → `security-reviewer`. On a SPA, "high-risk" means:
  - Auth token storage / refresh / logout
  - Anything rendering user-supplied HTML (`dangerouslyInnerHTML`, markdown renderers)
  - File upload / download flows
  - URL parameter handling that affects auth state or routing
  - Anything reading `localStorage` / `sessionStorage` / cookies for auth
  - Public API integrations exposing keys

### P8.1 confidence rubric (verbatim from source PR)

```
Tests pass (full suite ran AND green)             0.20
Principles checked (every MUST has a verdict)     0.20
No HIGH issues from any reviewer                  0.20
Domain gates passed (security/qa for relevant)    0.20
No open assumptions or unresolved questions       0.20
Sum < 0.90 → MUST revise the weakest area. Do not round up.
```

### P8.2 aggregation

```
final = min(model_rubric, every_subagent_confidence_that_ran)
BLOCK from any subagent → final = 0
Cite the binding subagent when it sets the floor:
  "Confidence: 0.85 (set by qa-validator coverage gap)"
```

---

## Phase 2 — Audit and integrate existing skills

The repo already has some skills. Don't blindly add the api-velocity catalog over them.

### Decision tree for each existing skill

For each existing skill, decide:

1. **Keep as-is** — it's repo-specific and well-written, no conflict with universals.
2. **Keep but rewrite description** — body is fine, but `description` is too vague to trigger reliably.
3. **Merge into universal** — it overlaps with `tdd-workflow` / `design-review` / `plan-mode` / etc. Migrate any unique content into the universal skill, then delete.
4. **Promote to repo-conventions** — it documents this repo's conventions inline. Move content into the new `repo-conventions` skill.
5. **Delete** — stale, duplicate, or contradicts the new architecture.

### Universal skills to add (port from api-velocity)

These exist in api-velocity and apply unchanged to a React SPA:

| Skill | Why |
|---|---|
| `tdd-workflow` | Same workflow, regardless of stack |
| `design-review` | SOLID/DRY/KISS/SoC/YAGNI principles are stack-agnostic |
| `plan-mode` | When to plan, plan format, re-plan triggers |
| `failure-mode-analysis` | Edge-case enumeration before the failing test |
| `bug-investigation` | Repro → root cause → minimal fix |
| `rlm-explore` | LOCATE/EXTRACT/CHUNK/TRANSFORM/VERIFY for big context |
| `decision-rules` | Defaults under ambiguity |
| `pushback-templates` | When and how to push back |
| `git-workflow` | Approval-required git operations |
| `documentation-and-adrs` | When to write an ADR |
| `code-simplifier` | Cleanup pass on recently modified code |
| `cyclomatic-complexity` | Branch-reduction patterns |
| `meta-skill-hygiene` | Periodic audit of the skill library itself |
| `async-error-handling` | Promise composition, AbortSignal, error propagation — applies to React data-fetching |
| `typescript-advanced-types` | If the repo is TS |

### Stack-specific skills to create (React-flavored)

These are the React analog of api-velocity's `nestjs-*` skills. **Create them.** A React repo without them is missing the grounding layer.

| Skill | What it covers |
|---|---|
| `react-patterns` | Component composition, hook rules (rules-of-hooks, dependency arrays), `useEffect` discipline, lifting state, controlled vs uncontrolled, key prop, lists, fragments, refs vs state |
| `react-state-management` | When Context vs library; server state (TanStack Query / SWR / Apollo) vs client state (Zustand / Redux); colocation vs lifting; derived state pitfalls |
| `react-performance` | `React.memo` / `useMemo` / `useCallback` decision rules, virtualization, code-splitting, lazy boundaries, suspense, profiling |
| `react-data-fetching` | TanStack Query / SWR / RTK Query patterns; cache invalidation; optimistic updates; error boundaries; loading states; retry & timeout policy |
| `react-routing` | Route definitions, protected routes, loaders, navigation guards, search-param state, error boundaries per route |
| `react-forms` | React Hook Form / Formik patterns, controlled-vs-uncontrolled, validation library choice, error display, submit lifecycle |
| `react-testing` | Testing Library queries (priority order), `userEvent` over `fireEvent`, async assertions, mocking modules vs network, MSW for API mocking, when E2E vs unit |
| `accessibility` | Semantic HTML, ARIA only when needed, keyboard navigation, focus management, color contrast, screen-reader-only text, axe checks. **MUST-fire on any UI change.** |
| `frontend-security` | XSS (escaping, `dangerouslyInnerHTML` discipline), CSRF context (cookie vs token), token storage (where to put JWT), env var leakage (NEXT_PUBLIC_, VITE_), CSP, dependency security |
| `bundle-size` | Tree-shaking, lazy imports, side-effect-free packages, analyzing the bundle, image optimization, font loading |
| `js-performance-patterns` | Tight loops, memoization mechanics, large list handling — port from api-velocity but include browser-specific (rAF, IntersectionObserver, Web Workers) |

### `repo-conventions` (write from scratch — highest leverage)

This is the skill that makes the system *grounded*. For a React SPA, document:

- **Folder layout** — `src/` structure, where do features go (`features/`, `pages/`, `routes/`?), shared components vs feature components
- **Component naming and shape** — function components only? Default export vs named? File per component or grouped?
- **Hook conventions** — where custom hooks live, naming (`use*`), unit-test policy
- **State model** — which lib, when to use Context, server-state vs client-state split, persistence (if any)
- **Routing** — which lib, how protected routes work, where loaders live
- **Data fetching** — query key conventions, error boundary boundaries, loading-state UX
- **Styling** — which system, design-token source, theme model, dark-mode handling
- **Forms** — which lib, validation library, error-display convention
- **Test patterns** — Testing Library queries used (preferred order), when integration vs unit, fixture/factory location, MSW handler organization, what gets E2E
- **Type conventions** — `interface` vs `type`, prop type style, generic naming
- **Error handling** — error boundary placement, toast/notification system, user-facing copy source
- **Build/deploy** — env var handling, what's `VITE_`/`NEXT_PUBLIC_` vs server-only, PR preview deploys

The `description` MUST include `"Use ALWAYS when implementing, reviewing, or refactoring executable code in this repository (<repo-name>)"` so it auto-fires.

When a convention has a load-bearing *why*, write an ADR and **cite** it from `repo-conventions` instead of restating.

---

## Phase 3 — Subagents (the missing layer)

The repo has none. Port all 5 from api-velocity, adapting the body (not the structure) to frontend.

### Required subagents

```
.claude/agents/architect-reviewer.md   # PRE-impl plan critique
.claude/agents/code-reviewer.md        # POST-impl design review (SOLID/DRY/KISS/SoC...)
.claude/agents/qa-validator.md         # POST-impl coverage / edge cases / docs
.claude/agents/security-reviewer.md    # POST-impl OWASP top-10 + frontend security
.claude/agents/lessons-curator.md      # READ-ONLY proposer for skill/CLAUDE.md changes after corrections
```

### Subagent file template

```markdown
---
name: code-reviewer
description: Use ALWAYS after a feature/fix/refactor where 3+ files were modified OR auth/sessions/public-API/PII is touched. NOT optional for those scopes. Runs isolated DESIGN review against MUST principles (SOLID/DRY/KISS/SoC/YAGNI/cohesion/fail-fast/explicitness/SSoT). Test coverage delegated to qa-validator; security delegated to security-reviewer. Returns APPROVE / CHANGES REQUESTED / BLOCK. NOT for non-code work, incomplete implementations, or single-file trivial edits.
tools: Read, Grep, Glob, Bash
---

# Code Reviewer

Independent design-review pass after the main agent's TDD + self-review. Runs in fresh context — your verdict is intentionally not influenced by the main agent's confidence.

## Mandate
Read the modified files + tests + one level of surrounding context (callers, imports, type definitions). Apply the `design-review` skill's MUST principles. Return a structured verdict.

You are willing to BLOCK. **A reviewer that always approves doesn't matter.**

## Verdict format
- Verdict: APPROVE | CHANGES REQUESTED | BLOCK
- Confidence: 0.0–1.0
- Working Set: which files were actually read (RLM attestation — without this, the verdict is hallucinated)
- Findings: HIGH / MEDIUM / LOW with file:line references
```

### Frontend-flavored adjustments

- **`security-reviewer`** body: emphasize XSS sinks (`dangerouslyInnerHTML`, `innerHTML`, `eval`-equivalents), token storage (localStorage XSS exposure vs httpOnly cookies), env var leakage (anything `VITE_*` / `NEXT_PUBLIC_*` is **public** — never put secrets there), CSP, third-party script audit, dependency audit (`npm audit`), URL parameter handling, postMessage origin checks.
- **`qa-validator`** body: emphasize Testing Library query priority (role > label > placeholder > test-id), accessibility checks (axe), keyboard navigation paths, error-state coverage, loading-state coverage, MSW handler completeness, E2E coverage for critical paths.
- **`architect-reviewer`** body: pre-impl plan critique. On a SPA: state-lib choice, server-state vs client-state split, route boundary placement, error-boundary placement, code-splitting decisions, prop drilling vs context vs state lib.

### Critical rules (do not violate)

1. **Each subagent owns ONE concern.** No overlap. Overlap dilutes verdicts.
2. **Each is willing to BLOCK.** State this explicitly in the body.
3. **Each reports a Working Set.** Without RLM attestation, the verdict is hallucinated.
4. **Each returns its own confidence.** The router aggregates via `min()`.

---

## Phase 4 — ADRs for load-bearing frontend decisions

Create `docs/decisions/` with `_template.md`, `README.md`, and one ADR per load-bearing decision. Test for "load-bearing": would changing this rule require updating 3+ skills/docs/files? Yes → ADR.

### Likely React-SPA ADR territory

Write ADRs only for the decisions that *are* load-bearing in this repo. Common candidates:

```
ADR-001 — State management library choice (Zustand vs Redux Toolkit vs Context-only)
ADR-002 — Server-state library choice (TanStack Query vs SWR vs Apollo vs RTK Query)
ADR-003 — Routing library choice (React Router vs TanStack Router vs framework-native)
ADR-004 — Styling system choice (Tailwind vs CSS Modules vs styled-components)
ADR-005 — Form library choice (RHF vs Formik vs none)
ADR-006 — Test stack (Vitest vs Jest, Testing Library, MSW, Playwright vs Cypress)
ADR-007 — Type system policy (strict mode, no `any` policy, generic naming)
ADR-008 — Auth token storage (httpOnly cookies vs localStorage with refresh)
ADR-009 — Skill-vs-repo conflict resolution (port verbatim from api-velocity ADR-007)
ADR-010 — No AI-attribution trailers (port verbatim from api-velocity ADR-008)
ADR-011 — Asks-first dependency gate (port verbatim from api-velocity ADR-006)
```

### ADR template

```markdown
# ADR-NNNN: <title>

- Status: accepted | superseded by ADR-MMMM | deprecated
- Date: YYYY-MM-DD
- Deciders: <roles>

## Context
<What forced the decision. The constraint, not the solution.>

## Decision
<The rule, in one paragraph.>

## Consequences
<What this commits us to. What it makes harder. What gets cited.>

## Alternatives considered
<Briefly, with why each was rejected.>
```

ADRs exist so `repo-conventions` and CLAUDE.md can **cite** instead of **restate**.

---

## Phase 5 — Permission hardening (`.claude/settings.json`)

Move machine-enforceable rules out of prose into config:

```json
{
  "permissions": {
    "deny": [
      "Bash(git push origin main:*)",
      "Bash(git push origin master:*)",
      "Bash(git commit*main*)",
      "Bash(git commit*master*)",
      "Bash(git push --force*)",
      "Bash(git reset --hard origin/main*)",
      "Bash(npm publish*)"
    ],
    "ask": [
      "Bash(git commit*)",
      "Bash(git push*)",
      "Bash(gh pr create*)",
      "Bash(gh pr merge*)",
      "Bash(vercel deploy*)",
      "Bash(netlify deploy*)",
      "Bash(npm version*)"
    ]
  }
}
```

CLAUDE.md still states the rules in prose (P0); settings enforces them mechanically. Belt and suspenders.

---

## Phase 6 — Memory loop wiring

Memory lives at `~/.claude/projects/<encoded-repo-path>/memory/`. Encoded path = absolute path with `/` replaced by `-`, prefixed by `-`.

CLAUDE.md must reference memory in:

- **P5** — "Consult feedback memories first." Before any code change, MUST read `MEMORY.md` index and any linked `feedback`-type memory files for the area being changed.
- **P7** — Reflexive lesson capture. After ANY user correction (signals: `"no, that's wrong"`, `"you should have"`, `"we discussed this"`, `"stop doing X"`, `"next time"`), the IMMEDIATE next response MUST:
  1. Write a `feedback`-type memory file with **rule + Why + How to apply**.
  2. Output the literal line: `Lesson captured to memory. Want lessons-curator to refine it? (reply 'yes' / 'curate that' / 'skip')`

The `lessons-curator` subagent (read-only) proposes ONE concrete skill/CLAUDE.md change for approval. It does not write files. Memory is the durable record; curator is optional refinement.

---

## Phase 7 — Validate end-to-end

Before declaring the refactor complete, run these checks:

1. **Word-count check.** New CLAUDE.md ~3,000 words. Much smaller → router under-specified. Much larger → didn't extract enough to skills.

2. **No dangling doctrine.** Grep the old monolith for every MUST/SHOULD. Each must now live in (a) new CLAUDE.md, (b) a skill, or (c) intentionally dropped with reason. Nothing silently disappears.

3. **Skill-trigger sanity.** For each skill, ask: would a reasonable user prompt cause this `description` to match? If not, rewrite.

4. **MUST-fire list completeness.** Critical skills (`tdd-workflow`, `design-review`, `repo-conventions`, `failure-mode-analysis`, `react-patterns`, `accessibility`) MUST be in P3.4. Description-trigger alone is unreliable.

5. **Subagent BLOCK semantics.** Each agent file states it's willing to BLOCK and explains the verdict format including Working Set attestation.

6. **No subagent overlap.** `code-reviewer` and `qa-validator` and `security-reviewer` cover non-overlapping concerns.

7. **Permission consistency.** Every P0 prose rule has a `deny` or `ask` entry in `.claude/settings.json` or is explicitly prose-only.

8. **ADRs cited, not restated.** Grep CLAUDE.md and `repo-conventions` for `because` / `the reason` / `we chose`. Most should be replaced by `(see ADR-NNN)`.

9. **End-to-end smoke test — pick a representative task.** E.g.: "Add a new route with a protected page that fetches user data and shows a loading state." Verify:
   - Enters plan-mode (P3.4 force-load).
   - Invokes `repo-conventions`, `react-patterns`, `react-data-fetching`, `accessibility`, `failure-mode-analysis`.
   - Writes failing tests before the implementation.
   - Calls `architect-reviewer` pre-impl (architectural change: new route).
   - Calls `code-reviewer` + `qa-validator` post-impl. Calls `security-reviewer` if auth was touched.
   - Final confidence respects `min()` of model + subagents.
   - Output follows P8 contract including `Skills consulted:` line.

   If any step doesn't happen, the router has a hole. Fix before declaring done.

---

## Common pitfalls (the failure modes that bite)

1. **Adding api-velocity skills wholesale without auditing existing ones** → silent contradictions between two skills triggering on the same prompt.

2. **`repo-conventions` description too vague** → doesn't auto-fire, repo-grounding never happens, model defaults to generic React advice.

3. **Skipping ADRs** → conventions in `repo-conventions` get reasoned about every time, drift across files, no canonical "why."

4. **Subagent overlap** → if `code-reviewer` and `qa-validator` both check tests, neither is the trusted source. Owner-per-concern is the rule.

5. **Subagents that won't BLOCK** → no signal. State willingness to BLOCK explicitly.

6. **Confidence as vibes** → if P8.1's rubric isn't enforced, "0.92" is meaningless. The rubric is a 5-row table, each row earned or not.

7. **No P3.4 force-load** → trusting description-triggers means doctrine-critical skills silently no-op when prompts don't happen to match.

8. **Frontend-specific traps:**
   - Forgetting `accessibility` as a force-fire skill (a11y regressions are easy to miss in self-review).
   - Putting `dangerouslyInnerHTML` rules in `react-patterns` instead of `frontend-security`.
   - Missing the env-var leak surface (`VITE_*` / `NEXT_PUBLIC_*` are public — `security-reviewer` must check for secrets there).
   - Not gating deploy commands in `settings.json`.

9. **Updating monolith and skills in parallel** → confusion about which is authoritative. Delete from the monolith as you extract; final state has one CLAUDE.md.

10. **Process overhead on trivial work** → workflow chains followed literally add ceremony to small tasks. The "deviate only with reason" hedge in chains exists for this.

---

## Suggested commit sequence

Mirrors the source PR's order. Each commit reviewable in isolation.

```
1.  chore(claude): archive monolithic CLAUDE.md as .pre-refactor.bak
2.  chore(claude): introduce settings.json permission gates
3.  chore(claude): audit existing skills (decisions logged in commit body)
4.  chore(claude): add universal skills (tdd-workflow, design-review, plan-mode, ...)
5.  chore(claude): add react-stack skills (react-patterns, react-state-mgmt, accessibility, ...)
6.  chore(claude): write repo-conventions skill from repo audit
7.  chore(claude): introduce 5 review subagents (architect/code/qa/security/curator)
8.  chore(claude): introduce ADRs (docs/decisions/) for load-bearing decisions
9.  chore(claude): rewrite CLAUDE.md as priority-ordered router (P0–P9 + Pointers + Chains)
10. chore(claude): wire memory + lesson capture loop (P5 + P7)
11. chore(claude): validate end-to-end on representative task; fix gaps
```

---

## What success looks like

You're done when:

1. CLAUDE.md is ~3,000 words, priority-ordered, contains zero inline principle definitions or TDD step lists.
2. Every doctrine point from the old monolith lives at exactly one canonical site (skill, ADR, or new CLAUDE.md).
3. The 5 subagents exist, each with a single concern, each willing to BLOCK, each reporting a Working Set.
4. `repo-conventions` documents this codebase concretely — folder layout, state model, routing, styling, testing — and cites ADRs for load-bearing rationale.
5. `accessibility` is a force-fire skill on any UI change.
6. `frontend-security` covers the SPA-specific surface (XSS sinks, env var leakage, token storage, CSP).
7. `.claude/settings.json` mechanically enforces P0 rules.
8. Memory loop is wired (P5 reads, P7 writes).
9. The smoke test in Phase 7 step 9 passes — all expected skills/agents fire on the representative task.

That's the system.
