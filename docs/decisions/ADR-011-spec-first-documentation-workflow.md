# ADR-011: Specification-first documentation workflow

- **Status:** Accepted
- **Date:** 2026-06-04
- **Deciders:** Mariano Ravinale (with architect-reviewer)

## Context

The LLM jumped straight to code, leaving no durable SPEC/PRD history, stale docs after bug
fixes, undocumented or wrong assumptions, and steady code↔doc drift. CLAUDE.md enforced TDD,
review subagents, and a definition of done, but nothing required *documentation* before code.
Full design + architect-review outcome: `docs/spec-first-workflow-proposal.md`. This decision is
load-bearing — it adds a force-fire skill (P3.4), a review subagent (P4), a definition-of-done
clause (P8.0), a new priority subsection (P3.0), a doc folder, a CI gate, and a new agent.

## Decision

Every **behavioral** code change MUST create or update a Markdown SPEC under `docs/specs/`
(per-repo, layer-split: this repo = `ui`, api-velocity = `contract`) BEFORE implementation, with
material ambiguities resolved with the user, and reconcile it with what shipped AFTER. The
`spec-workflow` skill is the procedure; the write-capable `spec-steward` agent (scoped to
`docs/specs/**`) is the single writer; the `spec-gate` CI workflow + completeness/links lints are
the deterministic guarantee. The only exemptions are the `tdd-workflow` waiver categories
(non-code / type-only / config-no-behavior); "small/obvious/trivial" are never exempt.

## Alternatives considered

- **Plan-mode only (no persisted artifact):** rejected — `plan-mode` is ephemeral; it leaves no
  durable, versioned record and cannot be gated in CI, so docs drift exactly as before.
- **A single shared docs repo / specs only in spa-velocity:** rejected — a spec detached from a
  repo's own CI can't be gated when that repo changes alone; a backend-only change would not
  trigger any spec update (silent drift). Per-repo layer-split closes that gap.
- **Read-only spec author (propose, don't write):** deferred as the fallback — the write-capable
  steward owns docs end-to-end; if one agent holding both "judge" and "fix" proves too much, the
  read-only variant is a drop-in (proposal §15).

## Consequences

- **Positive:** durable spec history; assumptions surfaced + corrected; code↔doc drift caught by a
  hard gate, not goodwill; specs are the artifact `architect-reviewer` reviews pre-implementation.
- **Negative:** two specs per cross-cutting feature (one per layer) + cross-links to maintain; a
  first write-capable subagent (precedent) — contained mechanically to `docs/specs/**`; the router
  is near its size ceiling (P3.0 added; future additions need trimming).
- **Follow-ups:** feature backfill (separate SPEC-000-tracked PRs); the OpenAPI machine-link is
  deferred pending the cross-repo CI Phase C.

## References

- Source files where the rule manifests: the `spec-workflow` skill, the `spec-steward` agent, the
  `spec-gate` workflow, `scripts/spec-*.sh`, `docs/specs/`.
- Skills that cite this ADR: `spec-workflow`, `documentation-and-adrs`.
- CLAUDE.md sections: P3.0, P3.4, P4.1, P8.0.
- Related: `SPEC-000`; api-velocity counterpart ADR (its own next free number).
- **Number contention:** an in-flight `ci-gates-plan` also eyed ADR-011 for OpenAPI codegen. On
  `origin/main` 011 was free, so this workflow took it; the CI-gates ADR must use the next free
  number. First-to-merge wins; the other renumbers.
