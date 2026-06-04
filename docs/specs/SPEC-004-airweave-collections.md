---
id: SPEC-004
title: "SPEC-004: Airweave collections & source connections"
status: Implemented
layer: ui
owner: Mariano Ravinale
created: 2026-06-04
updated: 2026-06-04
feature_paths:
  - src/features/Airweave
related_adrs: []
related_specs: [SPEC-002]
counterpart_spec: "api-velocity#SPEC-004"
coordination_doc: ""
---

# SPEC-004: Airweave collections & source connections

> **Backfill** — current, test-backed behavior. ACs map to existing tests. (Cross-repo: collection
> ownership via `organization.metadata` and the OAuth-widget contract live in `api-velocity ADR-011` /
> `api-velocity#SPEC-004`.)

## 1. Summary (intended behavior)

Manage Airweave **collections** (knowledge bases owned by the active organization) — create, list,
rename, delete — and their **source connections** (data sources via direct-auth credentials or the
OAuth catalog widget). Responses use a `{data:T}` envelope unwrapped by `parseAirweaveResponse`, which
throws a typed `AirweaveApiError` carrying `.status`/`.body` (e.g. 409 in-use project list, 429
retry-after). Session tokens are **scrubbed** from error messages. RBAC affordances
(`airweave:read|create|update|delete|manage-sources`) are hidden (not disabled) for members.

## 2. Context & problem

This feature crosses a trust boundary (OAuth tokens, cross-org isolation, credential JSON) and was
undocumented. Two security-relevant behaviors are load-bearing: the typed error contract and
session-token scrubbing. OAuth now routes through the SDK catalog widget (api ADR-011 Amendment 4),
not an in-app form.

## 3. Scope

**In scope:** collection CRUD (+ 409 in-use, 429 rate-limit), source-connection CRUD + reauth, the
OAuth connect-session token issuance (+ orphan-prevention on unmount), `{data}` envelope parsing +
typed errors, session-token scrubbing, RBAC affordance gating, cache invalidation on mutations.

**Out of scope / non-goals (thin coverage — §9):** collection-search UX e2e, slug-hint error-message
e2e, 429 retry UX, cross-org 403 e2e (backend-gated), in-app OAuth form (removed — Amendment 4).

## 4. Assumptions

1. [Confirmed] Non-2xx → `AirweaveApiError` with `.status`/`.body`; 204 → undefined; body-less → fallback message (`api-response.test.ts`).
2. [Confirmed] `session_token` is redacted from error strings across `?`/`#`/`&`, case-insensitive (`scrub-session-token.test.ts`).
3. [Confirmed] Collections are org-owned; PATCH/DELETE/reauth are backend ownership-gated inline (api ADR-011 §7); the SPA does not pre-fetch to verify.
4. [Confirmed] OAuth flows through the catalog widget via `POST /api/airweave/connect/session`; the in-app OAuth form was removed (Amendment 4).

## 5. Affected areas

- `src/features/Airweave/{views,components,hooks,services,lib,schemas,types}/*`.
- `lib/api-response.ts` (envelope + `AirweaveApiError`), `lib/scrub-session-token.ts` (security).
- RBAC: `can("airweave", …)`, route gate `airweave:read`.
- API: `/api/airweave/collections[/:id]`, `/api/airweave/sources/:collectionId`, `/api/airweave/source-connections/:id[/reauth]`, `/api/airweave/connect/session` (counterpart `api-velocity#SPEC-004`).

## 6. Acceptance criteria (mapped to existing tests)

| # | Criterion | Proving test |
|---|---|---|
| AC1 | Response parsing: unwrap `{data}` on 200; undefined on 204; throw `AirweaveApiError` on non-2xx; fallback message | `lib/__tests__/api-response.test.ts:12,19,26,43` |
| AC2 | `session_token` redacted from errors (query/fragment/multi-param, multiple, case-insensitive) | `lib/__tests__/scrub-session-token.test.ts:5,11,17,27,45` |
| AC3 | Collections service: list (+`?search=`), get (URL-encoded id), create | `collections.service.test.ts:55,68,77,95` |
| AC4 | Delete 409 (in-use projects) and 429 (retryAfter) surface via `AirweaveApiError.body` | `collections.service.test.ts:142,169` |
| AC5 | Source connections: list, create direct-auth (verbatim body), rename, delete, reauth | `source-connections.service.test.ts:54,64,118,129,142` |
| AC6 | Connect-session issues a fresh token per call (primary OAuth path) | `source-connections.service.test.ts:97`; `AirweaveCollectionDetailPage.test.tsx:124` |
| AC7 | Connect-session: surfaces backend failure verbatim; after unmount fails fast + no backend hit (orphan prevention) | `AirweaveCollectionDetailPage.test.tsx:144,157` |
| AC8 | Direct-source dialog: invalid JSON / array / null / empty-object → inline error; valid → create with parsed object | `CreateSourceConnectionDialog.test.tsx:175,184,193,201,210` |
| AC9 | Collections page: hide Create for members, show for `airweave:create`; row per collection; empty state; row actions hidden w/o update+delete | `AirweaveCollectionsPage.test.tsx:95,108,124,151,169` |
| AC10 | Cache invalidation: create → all lists; rename → all + detail; delete → lists + remove detail/source caches | `hooks/__tests__/collection-hooks.test.tsx:94,114,138` |
| AC11 | e2e: create → POST → row → detail; rename → PATCH; delete → DELETE → gone; 409 → in-use screen, row stays | `e2e/airweave/collections-crud.spec.ts:75,113,158`; `delete-conflict.spec.ts:47` |
| AC12 | e2e RBAC: admin sees Create/row-actions/Add-source; member sees list only | `e2e/airweave/permissions.spec.ts:83,120` |

## 7. Implementation plan

N/A — backfill. Future Airweave changes update this spec first.

## 8. Testing plan

Unit: `src/features/Airweave/{lib,services,hooks,components,views}/__tests__/*`. e2e: `e2e/airweave/*` (collections-crud, permissions, source-connections-direct, delete-conflict). Run `npx vitest run src/features/Airweave`.

## 9. Risks & failure modes

- **Security**: session-token scrubbing (AC2) + typed-error contract (AC1) are defense-in-depth; OAuth token issuance is per-call and orphan-guarded (AC6/AC7).
- **Cross-org 403**: backend-gated; not e2e-covered here → **unverified** at the browser layer.
- 429/slug-hint/search UX: logic/schema tested, end-to-end UX not e2e-covered.

## 10. Open questions

- Should the api counterpart own the source-catalog contract the widget consumes? (Resolve in `api-velocity#SPEC-004`.)

## Change Log

- 2026-06-04 · PR (backfill) · created · documents current Airweave behavior; 12 ACs mapped to existing unit/service/hook/component/e2e tests.
