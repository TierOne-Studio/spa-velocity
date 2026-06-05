---
id: SPEC-007
title: "SPEC-007: Dashboards (admin metrics + user account/settings)"
status: Implemented
layer: ui
owner: Mariano Ravinale
created: 2026-06-04
updated: 2026-06-04
feature_paths:
  - src/features/AdminDashboard
  - src/features/Dashboard
related_adrs: []
related_specs: [SPEC-002]
counterpart_spec: "standalone"
coordination_doc: ""
---

# SPEC-007: Dashboards

> **Backfill** — current, test-backed behavior. ACs map to existing tests. UI-only aggregators:
> AdminDashboard reads `/api/admin/dashboard/*` (aggregations over other modules — no dedicated api
> module), so `counterpart_spec: standalone` (see §10 open question).

## 1. Summary (intended behavior)

**AdminDashboard** (`dashboard:view`, superadmin org-scoping) shows platform metrics in four sections
— Overview KPIs, Chat Intelligence, User Activity, Org Activity — over a selectable time range
(7d/30d/90d, default 30d), with a superadmin scope picker (all-orgs vs single org) and a system-view
banner. **User Dashboard** (`/account`, `/settings`) are authenticated-only placeholders ("coming soon").

## 2. Context & problem

The admin dashboard is the highest-information-density admin surface and was undocumented; the user
Dashboard pages are stubs. Capturing both prevents the stubs from being mistaken for complete features
and documents the metrics contract + scoping rules.

## 3. Scope

**In scope:** AdminDashboard page structure, time-range selection + propagation, superadmin org
scoping (picker, banner, scoped-id vs null to hooks), the 5 data hooks + 5 service endpoints (success +
params + error), Overview KPI cards, the three section components; `dashboard:view` gating.

**Out of scope / non-goals:** **User Dashboard `/account` + `/settings` are placeholders** (no
functionality, no tests); actual chart pixel rendering (charts mocked in tests); error-recovery UI;
responsive/visual snapshots; real backend filtering (params asserted, not server behavior).

## 4. Assumptions

1. [Confirmed] AdminDashboard is gated by `dashboard:view` via `<AdminRoute>`; the superadmin scope picker only renders for superadmins (`AdminDashboardPage.test.tsx:269,312`).
2. [Confirmed] Default range is 30d; range changes propagate to the chat section (`AdminDashboardPage.test.tsx:401`).
3. [Confirmed] In all-orgs mode the hooks receive `null` (no org filter); in single-org mode they receive the scoped org id (`AdminDashboardPage.test.tsx:296,347`).
4. [Confirmed] User Dashboard `/account` + `/settings` are placeholder pages with no tests; the index route redirects to `/chat`.

## 5. Affected areas

- `src/features/AdminDashboard/{views,hooks,services,components,types}/*` — AdminDashboardPage, `useAdminDashboard` (5 hooks), `adminDashboard.service` (5 endpoints), OverviewCards, ChatIntelligenceSection, UserActivitySection, OrgActivitySection.
- `src/features/Dashboard/views/{AccountPage,SettingsPage}.tsx` — placeholders.
- RBAC: `<AdminRoute requiredPermission={{resource:"dashboard",action:"view"}}>`.
- API: `GET /api/admin/dashboard/{overview,users,chat,organizations,organizations/list}` (aggregations; no dedicated module).

## 6. Acceptance criteria (mapped to existing tests)

| # | Criterion | Proving test |
|---|---|---|
| AC1 | Page renders heading + all four section components | `AdminDashboardPage.test.tsx:226,238` |
| AC2 | Loading skeletons while chat/user/org stats load | `AdminDashboardPage.test.tsx:247` |
| AC3 | Default range 30d; change via select propagates to chat section; empty-toggle guard | `AdminDashboardPage.test.tsx:401,410` |
| AC4 | Superadmin: scope picker + system-view banner in all-orgs mode; both hidden for non-superadmin | `AdminDashboardPage.test.tsx:269,279,312,324` |
| AC5 | All-orgs mode passes `null` to hooks; single-org passes the scoped id; fallback for missing org name | `AdminDashboardPage.test.tsx:296,347,374` |
| AC6 | 5 hooks fetch with correct keys/params + handle success (overview/users/chat/orgs/available) | `useAdminDashboard.test.ts:38,61,85,109,124,147` |
| AC7 | 5 service endpoints hit correct URLs (± `organizationId`, ± `range`) and throw on error | `adminDashboard.service.test.ts:37,55,84,109,127` |
| AC8 | OverviewCards: 4 KPI cards, loading skeletons, values/subtitles, null-token dash | `OverviewCards.test.tsx:18,27,36,45,54` |
| AC9 | Section components render their headings/charts/tables (incl. empty arrays gracefully) | `ChatIntelligenceSection.test.tsx:64`; `UserActivitySection.test.tsx:77`; `OrgActivitySection.test.tsx:49,76` |

## 7. Implementation plan

N/A — backfill. When the user Dashboard stubs gain real functionality, this spec is updated (or split) first.

## 8. Testing plan

Unit/component: `src/features/AdminDashboard/{views,hooks,services,components}/__tests__/`. User Dashboard has none (placeholders). Run `npx vitest run src/features/AdminDashboard`.

## 9. Risks & failure modes

- **User Dashboard is a stub** — `/account`, `/settings` do nothing; don't mistake them for complete.
- Charts are mocked in tests → pixel rendering unverified.
- Service tests assert request params, not server-side filtering correctness (that's the api side).
- `dashboard:view` gate is tested via mocked `<AdminRoute>`, not e2e.

## 10. Open questions

- The `/api/admin/dashboard/*` aggregation endpoints have no dedicated api module. Should they get an `api-velocity` contract spec (then set `counterpart_spec` accordingly), or stay documented here as a ui-only aggregation? (Currently `standalone`.)

## Change Log

- 2026-06-04 · PR (backfill) · created · documents AdminDashboard (well-tested) + flags user Dashboard as placeholder; 9 ACs mapped to existing tests.
