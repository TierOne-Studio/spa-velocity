---
name: spec-workflow
description: Use ALWAYS before implementing any behavioral code change (new feature, improvement, bug fix, refactor that changes behavior, behavioral change, requirement-correction, follow-up) — a Markdown SPEC under docs/specs/ MUST be created or updated, and clarifying questions asked, BEFORE writing code; and reconciled with what shipped AFTER. Governs the docs/specs/ folder, SPEC naming, the SPEC template, create-vs-update rules, the requirements clarification gate, the pre/post workflow, and code↔doc sync. The spec-steward agent is the writer; this skill is the procedure. NOT for non-code, type-only, or config-with-no-behavior changes (state the waiver phrase). Pairs with documentation-and-adrs (ADRs), plan-mode, tdd-workflow, acceptance-verifier, cross-repo-workspace.
---

# Spec Workflow

Documentation is part of the implementation, not an extra. Every **behavioral** code change
begins by creating/updating a Markdown SPEC and ends by reconciling it with what shipped.
The **`spec-steward`** agent is the single writer of `docs/specs/**`; this skill is the procedure
it and the main agent follow. Full design + rationale: `docs/spec-first-workflow-proposal.md`;
the load-bearing decision is `ADR-011`.

## Where specs live (per-repo, split by layer)

- This repo (spa-velocity) holds **`ui`** specs: screens, flows, forms, client validation, UX.
- `api-velocity/docs/specs/` holds **`contract`** specs: entities, endpoints, DTOs, RBAC, migrations.
- A cross-cutting feature has **one spec per layer**, cross-linked via the `counterpart_spec`
  frontmatter field, bound by a coordination doc. See `cross-repo-workspace`. One spec per
  (feature × layer) — never two for the same layer.

## Naming & location

- `docs/specs/SPEC-NNN-<short-kebab>.md` (sequential, zero-padded, never reused).
- `docs/specs/PRD-NNN-<short-kebab>.md` only for an epic spanning ≥2 SPECs.
- Template: `docs/specs/_template.md`. Index: `docs/specs/README.md`.
- Change Log is an **embedded section** in each SPEC (append-only) — not a separate file.
- A SPEC **cites** ADRs; it never restates rationale (per `documentation-and-adrs`).

## Does this change need a SPEC?

YES for any change with **observable behavior**: feature, improvement, bug fix, behavioral
change, requirement-correction, follow-up, or a refactor that changes behavior.

The ONLY exemptions (state the exact phrase, mirroring `tdd-workflow` waivers):

```
SPEC waived — non-code change.
SPEC waived — type-only.
SPEC waived — config change with no behavior impact.
```

"small change", "obvious fix", "trivial", "just a refactor" are **NEVER** valid skips. A pure
no-behavior refactor needs no new SPEC, but if one exists for that feature, add a Change Log note.

## PRE-coding workflow (before any implementation or test code)

1. **Classify** the request; decide if it is behavioral (above). If exempt, state the waiver and stop here.
2. **Search** `docs/specs/README.md` + grep `docs/specs/` for a SPEC governing this feature/files. (Anti-duplicate.)
3. **Resolve ambiguity — the clarification gate.** Scan for underspecification across: goal,
   target user/role, scope, behavior (happy path + edge/error cases), data model
   (cardinality/nullability/validation), RBAC, acceptance criteria, affected surfaces, UX states.
   **Verify what the codebase already answers first**, then for each remaining dimension decide
   Known / Assumable-safe / **Must-ask**. If any Must-ask remains, the steward returns
   `NEEDS-INPUT` and the main agent **asks the user** (batched, ≤4, options where possible).
   **Do NOT write the SPEC or any code until material ambiguity is resolved.** Never ask what
   you can verify in the code; never guess past a material ambiguity.
4. **Decide create vs update** — if a SPEC already covers this feature, UPDATE it; never open a second.
5. **Create/update the SPEC** (via `spec-steward`) from `_template.md`. It must pass the
   readiness rubric before leaving `Draft`: goal + target user; in- and out-of-scope; every AC
   falsifiable + mapped to a planned test; data model fully typed; RBAC stated; every named
   edge/error case has defined behavior; **no `TBD`/placeholder in a load-bearing section**.
6. **Load-bearing check** — if the change makes a decision that would force updating 3+
   skills/docs/files, also write/cite an **ADR** (`documentation-and-adrs`).
7. **Architect review** — when the plan touches 3+ files OR auth/sessions/RBAC/route-guards/
   state-mgmt-rewrites/data-migration, route the SPEC through `architect-reviewer`
   (`APPROVE_PLAN`/`REVISE_PLAN`/`BLOCK`). Revise the SPEC on REVISE/BLOCK; no code until `APPROVE_PLAN`.
   Cross-repo: the architect reviews BOTH specs + the coordination doc together.
8. **Present** the SPEC (or its diff) + the architect verdict + the plan, then STOP for approval.

## DURING coding

If you discover the SPEC was wrong, incomplete, or based on a bad assumption, **STOP, fix the
SPEC first** (update assumptions + Change Log), then resume. Code must never silently diverge from the SPEC.

## POST-coding workflow (before declaring done / opening a PR)

Delegate to `spec-steward` (it edits `docs/specs/**`):

1. **Reconcile** — *Affected areas* matches the real diff; ACs updated if behavior changed; each AC linked to its now-green test (file:line).
2. **Assumptions** — mark each `Confirmed` or `Corrected` (strike + replace wrong ones). A `Confirmed` assumption the code contradicts is a `BLOCK`, not a silent rewrite.
3. **Change Log** — append `YYYY-MM-DD · PR #NN · <what> · <why>` (note corrected assumptions).
4. **Memory** — if an original assumption was wrong, the main agent also writes a `feedback` memory entry (P7).
5. **Status** — `Draft` → `Implemented`.
6. **Review chain** — `code-reviewer` + `qa-validator` (+ `security-reviewer` if applicable) + `spec-steward` + `acceptance-verifier`. The steward's `BLOCK` and `acceptance-verifier`'s `BLOCK` are binding on "done."
7. CI `spec-gate` must be green; for cross-repo, the `counterpart_spec` links must resolve.

## Definition of done (spec dimension; extends P8.0)

A behavioral change is not done until: a governing SPEC was created/updated this change and is
`Implemented`; every AC maps to an executed-green test; no assumption is `Unconfirmed` or
contradicted; the Change Log has this change's entry; Affected areas matches the diff; the SPEC
passed the readiness rubric with no unresolved Must-ask ambiguity; `spec-steward` returned
non-`BLOCK`; and CI `spec-gate` is green. When P4 triggered, `architect-reviewer` returned `APPROVE_PLAN`.

## Deterministic gates (the guarantee — not the agent)

- `scripts/spec-gate.sh` — behavioral `src/**` ⇒ `docs/specs/**` change (or `[skip-spec:…]` waiver). CI: `.github/workflows/spec-gate.yml`.
- `scripts/spec-complete-check.sh` — no placeholder/empty required section.
- `scripts/spec-links-check.sh` — `counterpart_spec`/`related_specs` resolve.

The agent makes these easy to satisfy; the scripts are what make the workflow true.
