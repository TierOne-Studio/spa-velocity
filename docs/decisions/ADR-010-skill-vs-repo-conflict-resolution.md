# ADR-010: Skill-vs-repo conflict resolution

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

The skill library captures broadly-applicable best practices (`react-patterns`, `react-state-management`, `frontend-security`, etc.). `CLAUDE.md` and `repo-conventions` capture the binding choices of *this* codebase (Zustand specifically, RHF+Zod specifically, `<ProtectedRoute>` specifically).

Sometimes a skill recommends a pattern that, applied to *this* repo, would force a structural change — a new dependency, a new cross-cutting infrastructure, an app-wide bootstrap modification, or a refactor of unrelated modules. Smuggling that change into a PR scoped to something else is a scope-discipline violation.

But always deferring to the existing repo state means the skill catalog never lands. Some rules from skills are universally correct and should win even when they conflict — e.g., "use `Promise.allSettled` when partial success is acceptable."

The team needs a tiebreaker rule.

## Decision

When a skill and `CLAUDE.md`/`repo-conventions` appear to conflict, the resolution follows this rule (P3.5):

> **Default: follow the skill.** Skills are the team's curated best-practice catalog and are the default source for situational guidance.
>
> **Override:** when applying the skill would require a *structural* change to the repo — a new dependency, cross-cutting infrastructure the repo lacks, an app-wide bootstrap modification, or a refactor of established patterns in unrelated modules — **follow the repo convention for the current PR** and recommend the skill's pattern as a Future task in the response's Optional Improvements section.

**Test for "structural":** would applying this best practice change code outside the current PR's scope? If yes → repo wins, recommend future task. If no → skill wins, apply now.

**What is NOT structural** (skill wins, no exception):
- Following the test-query priority (role > label > placeholder > test-id) in NEW component tests.
- Wrapping a multi-state effect in a custom hook for the current change.
- Choosing the right server-state vs client-state placement for a NEW data flow.
- Following the feature-folder layout for a NEW feature module.

**ADR coupling:** when a structural Approach IS eventually adopted (deferred and then implemented later), the adoption MUST include writing an ADR documenting the rationale. The Future-task entry should name the ADR explicitly.

## Alternatives considered

- **Always follow the skill.** Causes structural-refactor PRs to land bundled with feature work. Rejected as a scope-discipline failure.
- **Always follow the repo.** Skills never land. Library decays. Rejected as a maintenance failure.
- **Per-skill priority list.** Hard to maintain; would need updating every time a skill is added. Rejected.

## Consequences

- **Positive:** skills get applied where they genuinely fit; structural refactors are isolated to their own PRs with their own ADRs and reviewers.
- **Negative:** the "is this structural?" judgment is a real call the engineer has to make on every conflict. The decision-rules skill captures the test, but it's not always self-evident.
- **Follow-ups:** when an Optional Improvement / Future task accumulates 3+ "should adopt skill X" mentions, it's time to write the structural ADR and adopt.

## References

- [`decision-rules`](../../.ruler/skills/decision-rules/SKILL.md) § 6 — the skill-side mirror of this rule.
- [`documentation-and-adrs`](../../.ruler/skills/documentation-and-adrs/SKILL.md) — when adopting a structural change, write an ADR.
- CLAUDE.md P3.5.
