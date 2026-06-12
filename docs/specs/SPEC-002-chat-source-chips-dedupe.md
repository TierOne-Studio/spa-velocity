---
id: SPEC-002
title: "SPEC-002: Chat source chips — one chip per unique document"
status: Draft
layer: ui
owner: Maxi Schvindt
created: 2026-06-12
updated: 2026-06-12
feature_paths:
  - src/features/Chat
related_adrs: []
related_specs: [SPEC-001]
counterpart_spec: "standalone"
coordination_doc: ""
---

# SPEC-002: Chat source chips — one chip per unique document

## 1. Summary (intended behavior)

Each assistant message's "Sources" section renders **one chip per unique source
document** (`name` + `sourceName` + `webUrl`), regardless of how many retrieved
chunks of that document the message's persisted `metadata.sources` contains.
Sources with the same document name but different collections (or URLs) remain
separate chips.

## 2. Context & problem

Vector-db retrieval is chunk-level: the API's `mapSources` projection
(api-velocity `chat-agent.service.ts`) drops the chunk identity but keeps
chunk cardinality, so N chunks of one document persist as N identical
`{name, sourceName, webUrl, entityType}` entries in `metadata.sources`.
`ChatMessage` rendered one pill per entry, so a single document appeared as up
to 9–10 visually identical chips (`src/features/Chat/components/ChatMessage.tsx`,
Sources block). Historical message rows already contain these duplicate
entries, so a display-level fix is required to correct old messages too.

## 3. Scope

**In scope:**
- Render-time dedupe of source chips in `ChatMessage` (key: `name` + `sourceName` + `webUrl`).
- Regression coverage at the component layer.

**Out of scope / non-goals:**
- API-side dedupe in `mapSources` (api-velocity) so future rows persist one
  entry per document — proposed follow-up, separate PR/spec layer.
- Any change to `metadata.sources` persistence, retrieval ranking, or the
  `VECTOR_DB_MIN_SCORE_PCT` relevance floor.
- Chip ordering, styling, or link behavior.

## 4. Assumptions

1. [Confirmed] Persisted `metadata.sources` entries for one document are byte-identical after the API projection (verified against the `message` table, conversation `4091005f-…`, rows with 9–10 duplicate entries).
2. [Confirmed] No consumer relies on chip count equaling chunk count (chips carry no chunk info; `resultCount` metadata is unaffected).
3. [Confirmed] First-occurrence order is acceptable — entries arrive pre-sorted by relevance from `dedupeAndCapSources` (api-velocity).

## 5. Affected areas

- `src/features/Chat/components/ChatMessage.tsx` — `dedupeSources()` helper applied to the Sources block.
- `src/features/Chat/components/__tests__/ChatMessage.test.tsx` — regression tests.
- No routes, guards, API contracts, or schema affected.

## 6. Acceptance criteria (falsifiable; each maps to a test)

| # | Criterion (observable behavior) | Proving test (file:line) |
|---|---|---|
| AC1 | A message whose `metadata.sources` contains multiple entries with identical `name`/`sourceName`/`webUrl` renders exactly one chip for that document | `src/features/Chat/components/__tests__/ChatMessage.test.tsx` — "renders one chip per unique source when metadata contains chunk-level duplicates" |
| AC2 | Same-named documents from different collections render as separate chips | `src/features/Chat/components/__tests__/ChatMessage.test.tsx` — "keeps same-named sources from different collections as separate chips" |
| AC3 | Messages without duplicate sources render identically to before (no behavior change) | existing tests "renders sources when provided", "renders safe URLs as links", "does not render sources section when sources is empty" |

## 7. Implementation plan

1. Add failing component test for AC1 (and AC2 guard) — `files:` ChatMessage.test.tsx / `tests:` Vitest / `risk:` low / `slice:` 1.
2. Add `dedupeSources()` pure helper and apply as `uniqueSources` in the Sources render — `files:` ChatMessage.tsx / `tests:` suite green / `risk:` over-dedupe (mitigated by AC2) / `slice:` 1.

## 8. Testing plan

- Component (Vitest + Testing Library): AC1–AC3 in `ChatMessage.test.tsx`. AC1 verified failing pre-fix (3 chips rendered) — non-vacuous.
- Full unit suite: 1200 passed post-change.
- No Playwright e2e added: behavior is fully observable at the component layer (chip count per rendered message).

## 9. Risks & failure modes

- **Over-dedupe of legitimately distinct sources** — mitigated by including `sourceName` and `webUrl` in the key (AC2).
- **Empty/missing fields** — degenerate keys still compare consistently; empty source list renders no Sources section (existing test).
- **Two distinct documents with identical name within one collection** — would collapse to one chip; accepted: the persisted projection carries no other distinguishing field, so they are indistinguishable at the UI layer by construction.

## 10. Open questions

None blocking. Follow-up candidate: dedupe in api-velocity `mapSources` so newly persisted rows carry one entry per document (would make stored metadata match the displayed chips).

## Change Log

- 2026-06-12 · PR #30 · Initial spec + render-time dedupe of source chips in `ChatMessage` · duplicate chunk-level entries rendered as repeated identical pills.
