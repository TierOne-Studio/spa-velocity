---
id: SPEC-002
title: "SPEC-002: Admin & RBAC (users, roles, sessions, organizations, impersonation)"
status: Implemented
layer: ui
owner: Mariano Ravinale
created: 2026-06-04
updated: 2026-06-04
feature_paths:
  - src/features/Admin
  - src/shared/context/PermissionsContext.tsx
  - src/shared/components/AdminRoute.tsx
related_adrs: []
related_specs: [SPEC-001]
counterpart_spec: "api-velocity#SPEC-002"
coordination_doc: ""
---

# SPEC-002: Admin & RBAC

> **Backfill** — documents current, test-backed behavior. ACs map to existing tests.

## 1. Summary (intended behavior)

The Admin surface manages **users** (list/create/approve/reject/ban/unban/set-role/set-password/delete),
**roles & permissions** (system + custom org-scoped), **sessions** (list/revoke), **organizations**
(CRUD + members + invitations), and **impersonation** (start/stop with token preservation). All admin
routes and actions are gated by RBAC `can(resource, action)`; superadmin bypasses checks.

## 2. Context & problem

The admin/RBAC surface is the highest-privilege area of the app and was undocumented. This spec
captures the permission contract + capability flows so future changes move the spec with the behavior.
Permission resolution is FE-side via `PermissionsContext` against `GET /api/rbac/my-permissions`;
backend remains the authority (see counterpart `api-velocity#SPEC-002`).

## 3. Scope

**In scope:** user management, role/permission management, session management, organization
management, impersonation, `<AdminRoute>` permission gating, `can()` semantics.

**Out of scope / non-goals (thin coverage — see §9):** impersonation banner UI, manager cross-org
impersonation rejection (unit-mocked only, no e2e), bulk user delete UX, org-switch permission-cache
invalidation e2e.

## 4. Assumptions

1. [Confirmed] Superadmin short-circuits `can()` → always true (`PermissionsContext.test.tsx:137`).
2. [Confirmed] Permission strings are `"${resource}:${action}"`; UI hides (not disables) unpermitted affordances.
3. [Confirmed] Impersonation preserves the admin's token in `original_bearer_token` and sets `impersonation_mode` (`adminService.impersonation.test.ts`).
4. [Unconfirmed] Manager cross-org impersonation is rejected by the backend — asserted via mock, not e2e (§9).

## 5. Affected areas

- `src/features/Admin/views/{Users,Roles,Sessions,Organizations}Page.tsx`; `services/{rbac,admin,organization}Service.ts`; `hooks/use{Users,Roles,Organizations}.ts`.
- `src/shared/context/PermissionsContext.tsx` (`can`), `src/shared/components/AdminRoute.tsx`.
- API: `/api/rbac/*`, `/api/admin/users/*`, `/api/admin/users/{id}/{impersonate,sessions,ban,...}`, `/api/platform-admin/organizations/*` (counterpart `api-velocity#SPEC-002`).

## 6. Acceptance criteria (mapped to existing tests)

| # | Criterion | Proving test |
|---|---|---|
| AC1 | `can()`: true for granted, false for missing, true for superadmin even if list incomplete | `PermissionsContext.test.tsx:107,122,137` |
| AC2 | `<AdminRoute>`: unauth → /login; denied → fallback (default `/`); granted → children | `AdminRoute.test.tsx:52,67,81,95` |
| AC3 | Users: list (paginated/searchable), create | `adminService.users.test.ts:32,47,60`; `useUsers.test.tsx` |
| AC4 | Pending users: list, approve, reject-with-reason | `e2e/admin/users-pending-approval.spec.ts:73,109,138` |
| AC5 | Ban-with-reason sets banned=true; set-password | `users-pending-approval.spec.ts:195,238` |
| AC6 | Roles: create custom role, edit display name, manage permissions | `e2e/admin/roles-crud.spec.ts:85,111,135`; `rbacService.crud.test.ts:88,152,214` |
| AC7 | Roles page shows the 3 unified roles (admin/manager/member) with descriptions | `e2e/rbac/admin-role.spec.ts:73,82` |
| AC8 | Sessions: display, revoke one, revoke all | `e2e/admin/sessions-crud.spec.ts:67,85` |
| AC9 | Organizations: create (name/slug → POST), member + invitation management | `e2e/admin/organizations-crud.spec.ts:83`; `organizationService.test.ts` |
| AC10 | Impersonation start: calls unified endpoint, preserves original token, includes orgId when manager-scoped | `adminService.impersonation.test.ts:49,66,98,134` |
| AC11 | Impersonation start throws when no sessionToken in response | `adminService.impersonation.test.ts:177` |
| AC12 | Impersonation stop: restores original token; recovers on 404; legacy fallback | `adminService.impersonation.test.ts:199,220,284` |
| AC13 | `getMyPermissions` returns `[]` on non-ok / missing / filters non-strings | `rbacService.getMyPermissions.test.ts:27,35,51` |
| AC14 | Admin nav: superadmin/admin sees Users/Sessions/Organizations/Roles; impersonate option in user actions | `e2e/rbac/admin-role.spec.ts:39,125` |

## 7. Implementation plan

N/A — backfill. Future admin/RBAC changes update this spec first.

## 8. Testing plan

Unit: `src/features/Admin/{services,hooks}/__tests__/`, `src/shared/context/__tests__/PermissionsContext.test.tsx`, `src/shared/components/__tests__/AdminRoute.test.tsx`. e2e: `e2e/admin/*`, `e2e/rbac/*`. Run `npx vitest run src/features/Admin src/shared/context/__tests__/PermissionsContext.test.tsx` + the rbac/admin e2e suites.

## 9. Risks & failure modes

- **Manager cross-org impersonation** — backend-enforced; only unit-mocked here → **unverified** by e2e. Highest-risk gap.
- **Impersonation banner** — token flow tested; banner display not covered.
- Permission cache: keyed by `user.id + activeOrganizationId`; org-switch invalidation has unit coverage but no e2e.
- FE `can()` is UX-only; the backend is the authority (a hidden button is not a security control).

## 10. Open questions

- Should the api counterpart own the role/permission catalog as the SSoT the FE renders? (Resolve when authoring `api-velocity#SPEC-002`.)

## Change Log

- 2026-06-04 · PR (backfill) · created · documents current Admin/RBAC behavior; 14 ACs mapped to existing unit + e2e tests.
