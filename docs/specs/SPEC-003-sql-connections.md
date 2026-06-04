---
id: SPEC-003
title: "SPEC-003: SQL Connections (per-org CRUD + test-before-save)"
status: Implemented
layer: ui
owner: Mariano Ravinale
created: 2026-06-04
updated: 2026-06-04
feature_paths:
  - src/features/SqlConnections
  - src/features/Admin/components/OrganizationSqlConnectionsSection.tsx
  - src/features/Admin/components/SqlConnectionFormDialog.tsx
  - src/features/Admin/hooks/useSqlConnections.ts
  - src/features/Admin/utils/sqlConnectionDisplay.ts
related_adrs: []
related_specs: [SPEC-002]
counterpart_spec: "api-velocity#SPEC-003"
coordination_doc: ""
---

# SPEC-003: SQL Connections

> **Backfill** — current, test-backed behavior. ACs map to existing tests. (Cross-repo: the
> permission family + credential encryption live in `api-velocity ADR-012` / `api-velocity#SPEC-003`.)

## 1. Summary (intended behavior)

Per-organization CRUD for PostgreSQL connections, promoted to a first-class `/sql-connections` page.
Create/edit go through a form that **requires a successful connection test before submit**; any field
change after a passing test re-disables submit. Passwords are write-only (masked; "leave blank to
keep" on edit); SSL object config round-trips on edit. Connections show a status badge
(ready/error/connecting) with inline error detail. All gated by `sql-connection:*` permissions, scoped
to the active organization.

## 2. Context & problem

Database connections carry credentials and are RBAC- and org-sensitive; the flow was undocumented.
The test-before-save contract (and its invalidation on edit) is the load-bearing UX rule. Credential
encryption + the permission family are the api side's concern (`api-velocity#SPEC-003`).

## 3. Scope

**In scope:** list, create, edit, delete (with confirm), test-credentials (pre-save) + test-saved
(by id), the test→submit gating, password write-only handling, SSL object preservation, status
display + truncation, RBAC gating, per-org scoping, sidebar promotion.

**Out of scope / non-goals (thin coverage — §9):** delete e2e flow, edit e2e flow, complex SSL
object (rejectUnauthorized+ca) e2e, permission-denial e2e, multi-org isolation e2e, table-allowlist UI (not built).

## 4. Assumptions

1. [Confirmed] A successful test is required before submit; a post-test field change invalidates it (`SqlConnectionFormDialog.test.tsx:63,122`).
2. [Confirmed] On edit, password may be omitted ("keep stored") and the original SSL object is preserved (`SqlConnectionFormDialog.test.tsx:154`).
3. [Confirmed] Port must be a finite number in 1–65535; name/host/database/username required.
4. [Confirmed] Test/submit failures keep the dialog open and surface the backend error (alert + toast) (`SqlConnectionFormDialog.test.tsx:216,252`).

## 5. Affected areas

- `src/features/SqlConnections/views/SqlConnectionsPage.tsx`; `Admin/components/{OrganizationSqlConnectionsSection,SqlConnectionFormDialog}.tsx`; `Admin/hooks/useSqlConnections.ts`; `Admin/utils/sqlConnectionDisplay.ts`; `Admin/types/index.ts` (SqlConnection types).
- RBAC: `PermissionsContext`, `AdminRoute` (`sql-connection:read` route gate); sidebar `app-sidebar.tsx`.
- API: `GET/POST /api/sql-connections`, `PATCH/DELETE /api/sql-connections/:id`, `POST /api/sql-connections/test`, `POST /api/sql-connections/:id/test`, `POST /api/platform-admin/organizations/sql-connections/test` (counterpart `api-velocity#SPEC-003`).

## 6. Acceptance criteria (mapped to existing tests)

| # | Criterion | Proving test |
|---|---|---|
| AC1 | A successful test is required before create-submit becomes enabled | `SqlConnectionFormDialog.test.tsx:63` |
| AC2 | Changing any connection field after a passing test re-disables submit | `SqlConnectionFormDialog.test.tsx:122` |
| AC3 | Edit can test without re-entering password; object SSL config is preserved on save | `SqlConnectionFormDialog.test.tsx:154` |
| AC4 | Test failure shows the backend error (alert + toast), dialog stays open | `SqlConnectionFormDialog.test.tsx:216` |
| AC5 | Submit failure keeps the dialog open + shows the backend error | `SqlConnectionFormDialog.test.tsx:252` |
| AC6 | Display string: short preserved, long segments truncated with ellipsis, full string for title | `sqlConnectionDisplay.test.ts:9,20,31` |
| AC7 | Empty state → create flow → test endpoint called → new row appears "ready" | `e2e/admin/sql-connections.spec.ts:127` |
| AC8 | `/sql-connections` page renders for an admin with active org (heading + Add button) | `e2e/sql-connections/main-menu-promotion.spec.ts:77` |
| AC9 | Sidebar Main shows Collections + SQL Connections for users with read perms | `main-menu-promotion.spec.ts:96` |
| AC10 | Create-Organization modal omits the Airweave allowlist combobox (PR-2 strip) | `main-menu-promotion.spec.ts:130` |

## 7. Implementation plan

N/A — backfill. Future SQL-connection changes update this spec first.

## 8. Testing plan

Unit: `src/features/Admin/components/__tests__/SqlConnectionFormDialog.test.tsx`, `src/features/Admin/utils/__tests__/sqlConnectionDisplay.test.ts`. e2e: `e2e/admin/sql-connections.spec.ts`, `e2e/sql-connections/main-menu-promotion.spec.ts`. Run `npx vitest run src/features/Admin/components/__tests__/SqlConnectionFormDialog.test.tsx src/features/Admin/utils/__tests__/sqlConnectionDisplay.test.ts`.

## 9. Risks & failure modes

- **Credentials**: the FE sends the password in plaintext over TLS; encryption-at-rest is the api side's responsibility (`api-velocity#SPEC-003`). Password is write-only in the UI (never rendered back).
- **Delete / edit / permission-denial / multi-org isolation**: not e2e-covered → **unverified** at the browser layer (unit/hook coverage only).
- Error-status rendering (`status:"error"` + `statusError`) is component-tested but e2e mocks always return "ready".

## 10. Open questions

- Should the org-target field (ADR-012 amendment) for multi-org create be specced now or when built?

## Change Log

- 2026-06-04 · PR (backfill) · created · documents current SQL-connections behavior; 10 ACs mapped to existing component + e2e tests.
