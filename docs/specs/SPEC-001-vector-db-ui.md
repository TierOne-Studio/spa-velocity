---
id: SPEC-001
title: "SPEC-001: Vector Databases UI — CRUD, document upload, project attach"
status: Draft
layer: ui
owner: Maxi Schvindt
created: 2026-06-11
updated: 2026-06-11
feature_paths:
  - src/features/VectorDb
  - src/features/Projects
related_adrs: []
related_specs: []
counterpart_spec: "api-velocity#SPEC-001"
coordination_doc: ""
---

# SPEC-001: Vector Databases UI — CRUD, document upload, project attach

## 1. Summary (intended behavior)

An org user with the right permissions can manage vector-DB knowledge bases from the
SPA: list/create/rename/delete them on a dedicated page, upload documents into one and
manage its file list, and attach one or more vector DBs to a project as `vector_db`
data sources so project chat can ground answers on their content. Every action is
permission-gated per RBAC verb (`vector-db:read/create/update/delete/upload`), and all
state stays live via TanStack Query invalidation (document counts, statuses, file lists).

## 2. Context & problem

The contract layer (api-velocity SPEC-001) shipped org-scoped vector-DB knowledge bases
with an S3 → ingestion → Qdrant pipeline and a chat RAG provider. Without a UI, the
feature is API-only: no screen lists knowledge bases, nothing uploads documents, and
projects cannot attach a `vector_db` source. This spec governs the SPA half: the
VectorDb feature folder (`src/features/VectorDb/`), the navigation/route surface
(`src/app/views/AppRoutes.tsx`, `src/shared/components/ui/app-sidebar.tsx`), and the
project-attach surface in `src/features/Projects/`.

This spec is authored as-built for PR #26 (UI Slices 2 + 3 + 5b), reconciling the
spec-first gate retroactively — the feature predates the workflow's adoption in this repo.

## 3. Scope

**In scope:**

- `/vector-dbs` route + sidebar entry, both gated on `vector-db:read`.
- VectorDbsPage: list with status badge, document count, per-row actions (rename,
  delete, upload) gated per verb.
- Create / rename / delete dialogs with optimistic-free, invalidation-based refresh.
- UploadDocumentDialog as file manager: drop-zone upload (XHR progress), file list
  with status badges, file delete, client-side MIME/size validation.
- Project attach (Slice 5b): `vector_db` kind in Projects types, picker in
  ProjectFormDialog (create + edit diffing), icon/label in DataSourceKindIcon.
- Service layer + TanStack Query hooks for all of the above (`vectorDbService.ts`,
  `useVectorDbs`, `useCreateVectorDb`, `useUpdateVectorDb`, `useDeleteVectorDb`,
  `useUploadVectorDb`, `useVectorDbFiles`, `useDeleteVectorDbFile`, `vectorDbKeys.ts`).

**Out of scope / non-goals:**

- Chat UI changes (chat consumes attached sources via the existing project chat flow).
- Ingestion progress streaming/polling beyond status badges on list refetch.
- Superadmin cross-org browsing of vector DBs (list is active-org-scoped).
- Server-side enforcement (owned by api-velocity SPEC-001; the UI gates are UX, the
  API returns 403/404 regardless).

## 4. Assumptions

1. [Confirmed] The API envelope is `{ data: ... }` and errors surface non-2xx with a
   message body — handled by `lib/apiResponse.ts` + `VectorDbApiError`.
2. [Confirmed] `useVectorDbs()` is active-org-scoped (mirrors `useAirweaveCollections`,
   not org-parameterized like `useSqlConnections`); a superadmin operating on another
   org sees the active org's list and the API rejects cross-org attach.
3. [Confirmed] The project-attach picker shows ALL vector DBs status-annotated rather
   than filtering to `ready` (deliberate deviation from the database-source picker — a
   knowledge base starts `empty` and becomes useful after upload).
4. [Confirmed] `fetch` has no upload-progress API, so `uploadVectorDb` uses XHR with a
   progress callback.
5. [Corrected] Managers were assumed to keep file delete; RBAC was tightened on the API
   (managers: upload yes, delete no — rbac_023/rbac_024). The in-dialog file-delete
   button is not yet gated on `vector-db:delete` (see §10).

## 5. Affected areas

- `src/features/VectorDb/` — types, schemas (`vectorDbSchema.ts`), service
  (`vectorDbService.ts`), response unwrap (`lib/apiResponse.ts`), hooks (8 files),
  dialogs (Create/Rename/Delete/UploadDocument), `views/VectorDbsPage.tsx`, barrel.
- `src/app/views/AppRoutes.tsx` — `vector-dbs` route, `requiredPermission`
  `vector-db:read` (AppRoutes.tsx:199-206).
- `src/shared/components/ui/app-sidebar.tsx` — nav item gated on `can("vector-db", "read")`.
- `src/features/Projects/types/index.ts` — `vector_db` in `DataSourceKind`,
  `VectorDbSourceConfig`, source union, `CreateVectorDbSourceInput`.
- `src/features/Projects/components/ProjectFormDialog.tsx` — vector-DB MultiSelectCombobox
  (create + edit add/remove diff).
- `src/features/Projects/components/DataSourceKindIcon.tsx` — `vector_db` icon + label.
- API endpoints consumed: `GET/POST /api/vector-dbs`, `GET/PATCH/DELETE /api/vector-dbs/:id`,
  `POST /api/vector-dbs/:id/upload`, `GET /api/vector-dbs/:id/files`,
  `DELETE /api/vector-dbs/:id/files/:jobId`, plus project create/update with
  `vector_db` sources.

## 6. Acceptance criteria (falsifiable; each maps to a test)

| # | Criterion (observable behavior) | Proving test |
|---|---|---|
| AC1 | Service CRUD: list/get unwrap the envelope; create POSTs input; rename PATCHes; delete resolves on 200; non-2xx (incl. 409 on referenced delete) raises `VectorDbApiError` | `src/features/VectorDb/services/__tests__/vectorDbService.test.ts:59-151` |
| AC2 | Upload POSTs multipart FormData to `/api/vector-dbs/:id/upload` with bearer auth; non-2xx, network error, and invalid-JSON 2xx all reject with `VectorDbApiError` | `vectorDbService.test.ts:153-256` |
| AC3 | ProjectFormDialog submits selected vector DBs as `vector_db` initialSources on create | `src/features/Projects/components/__tests__/ProjectFormDialog.test.tsx:311` |
| AC4 | The attach picker offers non-ready (e.g. `empty`) vector DBs, status-annotated | `ProjectFormDialog.test.tsx:343` |
| AC5 | Editing a project adds and removes diffed `vector_db` sources | `ProjectFormDialog.test.tsx:358` |
| AC6 | `vector_db` sources render a dedicated icon + "Vector database" label (no airweave fallthrough) | `src/features/Projects/components/__tests__/DataSourceKindIcon.test.tsx` |
| AC7 | Project create flow with a `vector_db` source round-trips through the UI (route-mocked API) | `e2e/projects/projects-crud.spec.ts:259-268` |
| AC8 | Page actions are RBAC-gated per verb: create/update/delete/upload controls hidden without the matching permission (`VectorDbsPage.tsx:59-63`); route + nav gated on `vector-db:read` | Covered indirectly by the shared route-guard pattern; dedicated component test pending (§10) |

## 7. Implementation plan

Shipped in three slices on `feat/kb-crud` (as-built record):

1. **Slice 2 — CRUD UI.** files: VectorDb feature scaffold, route, sidebar, page,
   Create/Rename/Delete dialogs, hooks, service. tests: `vectorDbService.test.ts`.
   risk: envelope drift vs API. slice: independently shippable list/manage page.
2. **Slice 3 — upload + file manager.** files: `UploadDocumentDialog.tsx`,
   `useUploadVectorDb`/`useVectorDbFiles`/`useDeleteVectorDbFile`, XHR upload in
   service, `IngestionJob` type. tests: upload describe-block in the service test.
   risk: XHR edge cases (network error, malformed 2xx) — both tested. slice: upload
   independent of attach.
3. **Slice 5b — project attach.** files: Projects types, `ProjectFormDialog.tsx`,
   `DataSourceKindIcon.tsx`. tests: the three ProjectFormDialog cases + icon test +
   `ProjectsPage.test.tsx` mock wiring. risk: cross-org attach (API 404s; list is
   active-org-scoped). slice: attach UI independent of chat consumption.

## 8. Testing plan

- **Unit/component (Vitest + Testing Library):** service contract incl. all error
  paths (`vectorDbService.test.ts`), attach flow + icon/label
  (`ProjectFormDialog.test.tsx`, `DataSourceKindIcon.test.tsx`, `ProjectsPage.test.tsx`).
  Run: `npx vitest run src/features/VectorDb/ src/features/Projects/`.
- **E2E (Playwright):** `e2e/projects/projects-crud.spec.ts` exercises create-with-
  vector-db against a route-mocked `/api/vector-dbs`; runs in CI (global-setup writes
  a test user to the DB — full stack required locally).
- **Known coverage gaps:** no component tests for `VectorDbsPage`/dialogs (RBAC
  gating, statusError rendering, live count) — see §10.

## 9. Risks & failure modes

- **Upload partial failure:** XHR error/abort and non-2xx reject with a typed error and
  the dialog surfaces the message; the file list refetches so a server-created job is
  never hidden client-side.
- **Malformed success:** a 2xx with invalid JSON rejects rather than rendering nonsense (AC2).
- **Referenced delete:** API 409 when projects still reference the vector DB; surfaced
  via `VectorDbApiError` message in the delete dialog (AC1).
- **Cross-org leakage:** list and attach are active-org-scoped; the API is the
  enforcement point (404/403), the UI never widens visibility.
- **Stale counts/status:** mutations invalidate `vectorDbKeys` so document count and
  ingestion status converge on refetch; no optimistic writes that could desync.
- **Large/disallowed files:** client-side MIME/size validation rejects before upload;
  the server re-validates (limits owned by the API constants).

## 10. Open questions

1. **File-delete button gating:** managers now hold `vector-db:upload` without
   `vector-db:delete` (rbac_023/024); the in-dialog delete button should be hidden via
   `can("vector-db", "delete")`. API already enforces 403. Follow-up UI change.
2. **VectorDbsPage component tests:** AC8's per-verb gating and the `statusError.message`
   rendering deserve direct component coverage; currently indirect only.
3. **Vector-db e2e module:** a dedicated `e2e/vector-dbs/` suite (CRUD + upload happy
   path) does not exist yet; only the projects-attach e2e touches the feature.

## Change Log

- 2026-06-11 · PR #26 · Initial spec, authored as-built for UI Slices 2 + 3 + 5b ·
  retroactive reconciliation with the spec-first gate (SPEC-000) · assumption 5
  corrected (manager file-delete RBAC tightened server-side; UI gating pending).
