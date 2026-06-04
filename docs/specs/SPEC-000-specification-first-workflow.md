---
id: SPEC-000
title: "SPEC-000: Specification-first workflow"
status: Draft
layer: ui
owner: Mariano Ravinale
created: 2026-06-03
updated: 2026-06-03
feature_paths:
  - .ruler/skills/spec-workflow
  - .ruler/agents/spec-steward.md
  - .ruler/instructions.md
  - docs/specs
  - scripts
related_adrs: [ADR-011]
related_specs: []
counterpart_spec: "api-velocity#SPEC-000"
coordination_doc: "docs/spec-first-workflow-proposal.md"
---

# SPEC-000: Specification-first workflow

> Full design + rationale: [`docs/spec-first-workflow-proposal.md`](../spec-first-workflow-proposal.md).
> This SPEC is the dogfood: the spec-first workflow specced in its own format.

## 1. Summary (intended behavior)

Every *behavioral* code change in this repo must begin by creating/updating a Markdown SPEC
(this folder) before implementation, and end by reconciling that SPEC with what shipped —
enforced by a hard CI `spec-gate`, deterministic lints, and the `spec-steward` agent.
Documentation becomes part of the implementation, not an optional extra.

## 2. Context & problem

The LLM jumped straight to code, leaving no SPEC/PRD history, stale docs after bug fixes,
undocumented or wrong assumptions, and code↔doc drift. See the proposal §1.

## 3. Scope

**In scope (this repo, layer `ui`):** `docs/specs/` scaffolding; `spec-workflow` skill;
`spec-steward` agent (write-capable, scoped to `docs/specs/**`); router edits (P3.0 / P3.4 /
P4 / P8.0); CI `spec-gate` + `spec-links-check` + `spec-complete-check`; harness self-test
extensions; ADR-011.

**Out of scope / non-goals:** the feature backfill (separate SPEC-000-tracked PRs);
the OpenAPI machine-link (deferred — needs ci-gates Phase C); api-velocity's own install
(its own SPEC-000, layer `contract`).

## 4. Assumptions

1. [Confirmed] The harness is Ruler-generated: `.ruler/*` → `.claude/*` / `CLAUDE.md` / `AGENTS.md` via `npx ruler apply`.
2. [Confirmed] `run-acceptance.sh` hard-pins the agent set + ADR range + router word budget (T1/T3/T11/T12/T21/T23) — self-test edits must update those fixtures (§13.1).
3. [Confirmed] `spec-steward` is the first write-capable subagent; containment must be mechanical, not prose-only (test #10).
4. [Confirmed] On `origin/main`, ADR-011 is free here; `ci-gates-plan.md` also eyes 011 — contention resolved by whoever merges first (flagged in ADR-011).
5. [Unconfirmed] api-velocity uses `docs/decisions/` (it also has a `docs/adr/` dir) — verify before mirroring.

## 5. Affected areas

- `docs/specs/{README.md,_template.md,SPEC-000-*.md}`
- `.ruler/skills/spec-workflow/SKILL.md`, `.ruler/agents/spec-steward.md`, `.ruler/instructions.md` (P3.0/P3.4/P4/P8.0)
- `scripts/spec-gate.sh`, `scripts/spec-links-check.sh`, `scripts/spec-complete-check.sh`
- `.github/workflows/spec-gate.yml`
- `.ruler/tests/run-acceptance.sh` (T1/T3/T11/T12/T21/T23 + new write-scope T)
- `docs/decisions/ADR-011-spec-first-documentation-workflow.md` + `docs/decisions/README.md`

## 6. Acceptance criteria (falsifiable; each maps to a test)

| # | Criterion (observable behavior) | Proving test |
|---|---|---|
| AC1 | A behavioral `src/**` diff with no `docs/specs/**` change fails the gate | `scripts/spec-gate.sh` vs fixture (negative) |
| AC2 | The same diff + a spec change passes the gate | `scripts/spec-gate.sh` vs fixture (positive) |
| AC3 | A `[skip-spec: type-only]` waiver token passes the gate | `scripts/spec-gate.sh` vs fixture (waiver) |
| AC4 | A spec with an empty required section or `TBD` placeholder fails completeness | `scripts/spec-complete-check.sh` vs fixture |
| AC5 | A spec with an unresolved `counterpart_spec` fails the link lint | `scripts/spec-links-check.sh` vs fixture |
| AC6 | Generated `CLAUDE.md` contains P3.0 + the P3.4/P4 rows + P8.0 spec criteria | `run-acceptance.sh` new assertions |
| AC7 | `spec-steward` is present and write-capable; no other agent gained Edit/Write | `run-acceptance.sh` T3 + new write-capable assertion |
| AC8 | `npm run test:claude` is green after `npx ruler apply` | `run-acceptance.sh` + `simulate-prompts.sh` |

## 7. Implementation plan

Slicing: **risk-first** (deterministic core before prose before backfill). Dependency graph
+ per-slice detail in proposal §13.

1. Slice 0 — `docs/specs/` scaffolding (this SPEC). `files:` README, _template, SPEC-000. `slice:` 0.
2. Slice 1 — gate + lints + fixtures + CI + self-test (TDD). `tests:` AC1–AC5. `risk:` heuristic false-positives. `slice:` 1.
3. Slice 2 — `spec-workflow` skill + `spec-steward` agent. `slice:` 2.
4. Slice 3 — router edits → `npx ruler apply` → re-run self-test. `tests:` AC6–AC8. `slice:` 3.
5. Slice 4 — ADR-011 + `cross-repo-workspace` rule. `slice:` 4.

## 8. Testing plan

Deterministic core: `bash scripts/*.sh` against committed fixtures under `scripts/__fixtures__/`.
Harness: `npm run test:claude`. No app-runtime layer (this change touches the harness, not app code).

## 9. Risks & failure modes

- Gate heuristic false-positives on non-behavioral `.ts` edits → the three `[skip-spec:…]` tokens.
- Router word budget (T12 2700–3700) breached by P3.0 → keep P3.0 terse; depth in the skill.
- Write-capable agent leaks beyond `docs/specs/**` → mechanical containment (test #10).
- ADR-011 number collision with ci-gates-plan → flagged; first-to-merge wins.

## 10. Open questions

- api-velocity ADR location (`docs/decisions/` vs `docs/adr/`) — resolve before the api mirror.

## Change Log

- 2026-06-03 · PR (pending) · Slice 0 scaffolding + this SPEC authored · install of the spec-first workflow (spa-velocity, layer ui).
