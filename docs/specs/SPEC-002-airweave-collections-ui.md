---
id: SPEC-002
title: "SPEC-002: Airweave Collections UI — CRUD, source-connections, project attach"
status: Draft
layer: ui
owner: Mariano Ravinale
created: 2026-06-17
updated: 2026-06-17
feature_paths:
  - src/features/Airweave
  - src/features/Projects/components/ProjectFormDialog.tsx
related_adrs: []
related_specs: [SPEC-000]
counterpart_spec: "api-velocity#SPEC-002"
coordination_doc: ""
---

# SPEC-002: Airweave Collections UI — CRUD, source-connections, project attach

## 1. Summary (intended behavior)

An org user with the right permissions manages **Airweave Collections** from the SPA: a
`/collections` page lists the org's collections and lets admins create, rename, and delete them;
a detail page manages each collection's **source-connections** — adding one directly (API-key
auth) or through the Airweave Connect catalog widget (opened with a session token), plus
re-authenticating an OAuth source. A collection is attachable to a project (the project form's
"Airweave Collections" multi-select) so project chat grounds answers on it. Every control is
RBAC-gated per `airweave` verb, and state stays live via TanStack Query invalidation. The feature
reads consistently as "Airweave Collections" in all user-facing text, and the wire/config field
names it sends and reads match the backend's `airweaveCollection*` contract.

## 2. Context & problem

The contract layer (api-velocity SPEC-002 / ADR-011) ships org-scoped Airweave Collections with
ownership via an org-metadata allowlist, source-connections, a `connect/session` token endpoint,
and a chat RAG provider. The SPA half (the `Airweave` feature folder, the `/collections` route +
sidebar, and the project-attach surface) had no governing SPEC — it predates the spec-first
workflow. A branding pass then renamed the bare `collection*` identifiers to `airweaveCollection*`
across files, components, types, schemas, local vars, the wire/config fields the SPA exchanges with
the API, and all UI strings. Because that touched behavioral `src/**`, the spec-first gate
(SPEC-000) requires the governing SPEC to exist and reflect the contract. This SPEC backfills the
SPA feature and pins the renamed contract; the cross-repo contract is api-velocity#SPEC-002 +
api-velocity's ADR-011 Amendment 6 + its `docs/airweave-collections-rename-coordination-plan.md`.

## 3. Scope

**In scope:**

- `/collections` route + sidebar entry ("Airweave Collections"), gated on `airweave:read`; the
  legacy `/admin/airweave/*` redirect shim is preserved.
- `AirweaveCollectionsPage`: list with per-row actions (rename/delete) and a "Create Airweave
  Collection" action, all RBAC-gated; row click navigates to the detail page.
- `AirweaveCollectionDetailPage`: collection detail + its source-connections list, "Connect a
  source" (catalog widget via `connect/session`), "Add direct source", and the reauth row action.
- Dialogs: `CreateAirweaveCollectionDialog`, `RenameAirweaveCollectionDialog`,
  `DeleteAirweaveCollectionDialog` (incl. the 409 in-use flow), and the source-connection dialogs.
- Project attach: the "Airweave Collections" `MultiSelectCombobox` in `ProjectFormDialog`
  (create + edit add/remove diff), persisting `config.{airweaveCollectionReadableId,airweaveCollectionName}`.
- Admin `OrganizationsPage`: the allowlist display panel.
- Service + TanStack Query hooks (`airweave-collections.service.ts`, `source-connections.service.ts`,
  `useAirweave*` hooks, `airweaveKeys.ts`).
- The `airweaveCollection*` rename of wire/config consumers, internal symbols/files, and all UI
  strings ("Create/Rename/Delete Airweave Collection", "Airweave Collection in use", etc.).

**Out of scope / non-goals:**

- Server-side enforcement (owned by api-velocity#SPEC-002; the UI gates are UX, the API returns
  403/404/409 regardless).
- Changing the API endpoint path strings (`/api/airweave/collections`) or the TanStack query-key
  root (`['admin','airweave-collections']`) — both kept to avoid breakage / cache churn.
- The Airweave Connect widget internals (third-party SDK) and the live OAuth round-trip.
- Renaming the `AirweaveCollection.readableId` field (the collection's own id) or terse free service
  functions — kept.

## 4. Assumptions

1. [Confirmed] The wire/config field names the SPA sends and reads are `airweaveCollectionReadableId`,
   `airweaveCollectionId` (connect/session body), and `airweaveCollectionName`, matching the backend.
2. [Confirmed] `useAirweaveCollections()` is active-org-scoped; the list shows the active org's
   allowlisted collections and the API rejects cross-org access.
3. [Confirmed] The TanStack query-key root `['admin','airweave-collections']` is unchanged, so the
   rename causes no cache invalidation churn on deploy.
4. [Confirmed] API endpoint path strings stay `/api/airweave/collections` (route segment unchanged);
   only the JSON field names and the SPA's own identifiers change.
5. [Confirmed] The delete-conflict (409) body field is `airweaveCollectionReadableId`; the delete
   dialog reads only `projects` from it (the field rename is type-only on the consumer).
6. [Confirmed] `connect/session` is POSTed with `{ airweaveCollectionId }`; the backend ownership
   guard reads that body field.

> Correct any Unconfirmed assumption now, or implementation proceeds on it. (None are Unconfirmed.)

## 5. Affected areas

- `src/features/Airweave/` — `types/index.ts` (wire types: `AirweaveSourceConnection`,
  `DeleteAirweaveCollectionConflictBody`, `CreateAirweaveCollectionInput`), `schemas/airweave.schema.ts`
  (`createAirweaveCollectionSchema`/`updateAirweaveCollectionSchema`), `services/airweave-collections.service.ts`
  (renamed file; terse free fns kept) + `source-connections.service.ts`, `hooks/` (`airweaveKeys.ts`
  root kept; `useAirweave*`), `components/` (`CreateAirweaveCollectionDialog.tsx`,
  `RenameAirweaveCollectionDialog.tsx`, `DeleteAirweaveCollectionDialog.tsx`, source-connection
  dialogs/buttons), `views/AirweaveCollectionsPage.tsx` + `AirweaveCollectionDetailPage.tsx`, barrel.
- `src/app/views/AppRoutes.tsx` — `/collections` + `/collections/:airweaveCollectionReadableId`
  routes (gated `airweave:read`) and the legacy `/admin/airweave/*` redirect.
- `src/shared/components/ui/app-sidebar.tsx` — "Airweave Collections" nav item gated on
  `can("airweave","read")`.
- `src/features/Projects/components/ProjectFormDialog.tsx` — the Airweave Collections multi-select;
  sends/reads `config.{airweaveCollectionReadableId,airweaveCollectionName}`.
- `src/features/Admin/...` — `useAirweaveCollections` (cross-feature) + the allowlist panel in
  `OrganizationsPage.tsx`.
- API endpoints consumed: `GET/POST /api/airweave/collections`,
  `GET/PATCH/DELETE /api/airweave/collections/:id`, `POST /api/airweave/collections/:id/source-connections`,
  `GET /api/airweave/sources/:id`, `POST /api/airweave/connect/session`.

## 6. Acceptance criteria (falsifiable; each maps to a test)

| # | Criterion (observable behavior) | Proving test |
|---|---|---|
| AC1 | Service CRUD: list/get unwrap the envelope; create/rename/delete delegate; a 409 referenced-delete raises `AirweaveApiError` whose body carries `airweaveCollectionReadableId` + projects | `src/features/Airweave/services/__tests__/airweave-collections.service.test.ts` |
| AC2 | `connect/session` is POSTed with `{ airweaveCollectionId }`, and source-connection list responses are read under `airweaveCollectionReadableId` | `src/features/Airweave/services/__tests__/source-connections.service.test.ts`; `src/features/Airweave/hooks/__tests__/source-connection-hooks.test.tsx` |
| AC3 | ProjectFormDialog submits selected collections as `airweave_collection` initialSources with `config.{airweaveCollectionReadableId,airweaveCollectionName}`, and reads existing ones on edit | `src/features/Projects/components/__tests__/ProjectFormDialog.test.tsx` |
| AC4 | UI strings read "Airweave Collection(s)" (create/rename/delete, "in use", empty states, "Select Airweave Collections"); Vitest assertions match the new strings | `src/features/Airweave/views/__tests__/AirweaveCollectionsPage.test.tsx`; `src/features/Projects/components/__tests__/ProjectFormDialog.test.tsx`; `src/features/Admin/views/OrganizationsPage.test.tsx` |
| AC5 | End-to-end (live stack): list → create → detail → rename → delete; RBAC admin-vs-member affordances; 409 in-use flow; "Connect a source" POSTs `connect/session` with `airweaveCollectionId`; direct source-connection + reauth | `e2e/airweave/collections-crud.spec.ts`; `e2e/airweave/permissions.spec.ts`; `e2e/airweave/delete-conflict.spec.ts`; `e2e/airweave/catalog-flow.spec.ts`; `e2e/airweave/reauth.spec.ts`; `e2e/airweave/source-connections-direct.spec.ts` |
| AC6 | The renamed files/components/types/schemas resolve (no broken imports/barrel); query-key root unchanged | `npx tsc -b`; `npx vitest run` (full suite green) |

## 7. Implementation plan

The SPA feature shipped previously; this SPEC backfills it and the rename ships as the slices below
(mirrors `feat/airweave-collections-rename`; each carried its test updates).

1. **Wire + config field renames** — `files:` `Airweave/types`, `Projects/types`, `ProjectFormDialog`
   (read/send), `source-connections.service.ts` (connect/session body), e2e mocks. `tests:` service +
   hook unit tests; e2e mock payloads. `risk:` FE↔BE field drift. `slice:` ~95 LOC.
2. **Internal symbols + file/component renames** — `files:` `collections.service.ts` →
   `airweave-collections.service.ts`; `*CollectionDialog.tsx` → `*AirweaveCollectionDialog.tsx`;
   schemas/types/vars; barrel + import sites. `tests:` full Vitest suite + `tsc`. `risk:` broken
   imports. `slice:` mechanical.
3. **UI strings + assertions** — `files:` views/dialogs/`ProjectFormDialog`/`OrganizationsPage`.
   `tests:` Vitest + Playwright text assertions. `risk:` stale assertions. `slice:` ~18 strings.
4. **E2E stabilization + SPEC** — `files:` `e2e/projects/projects-crud.spec.ts` (flaky
   multi-select→submit fix), this SPEC. `slice:` test + docs.

## 8. Testing plan

- **Unit/component (Vitest + Testing Library):** service contract incl. the 409 body field
  (`airweave-collections.service.test.ts`), connect/session send + source-connection field reads
  (`source-connections.service.test.ts`, `source-connection-hooks.test.tsx`), project attach +
  config keys (`ProjectFormDialog.test.tsx`), UI strings (`AirweaveCollectionsPage.test.tsx`,
  `OrganizationsPage.test.tsx`). Run: `npx vitest run` (full suite green).
- **E2E (Playwright):** the `e2e/airweave/*` specs exercise the full flow against the live stack;
  verified 17/17 locally. `airweave-live.spec.ts` + `integration-smoke.spec.ts` hit the real
  Airweave service and run in CI.

## 9. Risks & failure modes

- **FE↔BE wire drift** (partial): a field renamed on one side only yields silent `undefined`.
  Mitigation: AC1/AC2 assert the new names; e2e mocks emit them; the cross-repo contract grep
  confirms parity with api-velocity#SPEC-002.
- **Broken imports on file move** (boundary): the dialog/service file renames could orphan imports
  or the barrel. Mitigation: `tsc -b` + full Vitest suite (AC6).
- **Cache churn** (boundary): renaming the query-key root would invalidate in-flight caches on
  deploy. Mitigation: the root `['admin','airweave-collections']` is explicitly kept.
- **Stale UI assertions** (malformed): UI-string renames break exact/regex text assertions.
  Mitigation: Vitest + Playwright assertions updated in lockstep (AC4, AC5).
- **Flaky multi-select→submit** (race): an open `MultiSelectCombobox` re-renders (floating-ui),
  detaching the submit button mid-click. Mitigation: close the popover deterministically and wait
  for the listbox to unmount before submitting (`projects-crud.spec.ts`).

## 10. Open questions

None blocking. Deferred (non-blocking): a dedicated consolidated "rename smoke" e2e (the existing
`e2e/airweave/*` suite already covers the flow); status moves to `Implemented` when this PR merges
and the SPEC is reconciled with the merged diff.

## Change Log

Append-only. Newest first.

- 2026-06-17 · PR #32 (feat/airweave-collections-rename) · Backfills the governing UI SPEC for the
  as-built Airweave Collections SPA feature and pins the `airweaveCollection*` rename of the
  wire/config consumers, internal symbols/files, and all UI strings. API endpoint path strings and
  the TanStack query-key root are unchanged. Created to satisfy the spec-first gate (SPEC-000) for
  the behavioral `src/features/Airweave` + `Projects` change; counterpart of api-velocity#SPEC-002.
  Also records the `projects-crud` multi-select→submit flake fix. Status stays `Draft` until merge. ·
  No assumption corrections.
