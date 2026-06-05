---
id: SPEC-006
title: "SPEC-006: Projects (CRUD, data-source linkage, org scoping)"
status: Implemented
layer: ui
owner: Mariano Ravinale
created: 2026-06-04
updated: 2026-06-04
feature_paths:
  - src/features/Projects
related_adrs: []
related_specs: [SPEC-002, SPEC-003, SPEC-004]
counterpart_spec: "api-velocity#SPEC-006"
coordination_doc: ""
---

# SPEC-006: Projects

> **Backfill** — current, test-backed behavior. ACs map to existing tests.

## 1. Summary (intended behavior)

A project groups conversations and **data sources** (Airweave collections, SQL databases, or external)
within an organization. Users list/create/edit/delete projects and attach/detach sources. The create
form supports targeting a non-active org (multi-org members) and filters collections by the org's
allowlist (non-superadmins); superadmins see all and can view cross-org via `scope=all`. The
organization is **immutable after creation**. Gated by `project:read|create|update|delete|manage-sources`.

## 2. Context & problem

Projects bind together SQL connections (SPEC-003) and Airweave collections (SPEC-004) and scope Chat
(SPEC-005); the flow was undocumented. The org-immutability rule and the edit-time source diffing
(add/remove only what changed) are the load-bearing behaviors.

## 3. Scope

**In scope:** list + search/filter, create (name/description/collections as `initialSources`,
org targeting), org/collection filtering by role + allowlist, edit (org read-only, diffed source
add/remove), delete + confirm, superadmin `scope=all`, multi-org non-active-org targeting.

**Out of scope / non-goals (thin coverage — §9):** database-source attach/detach (UI present, not
unit-tested), external sources (type only, no UI), form-submission error states, large-list pagination.

## 4. Assumptions

1. [Confirmed] The organization is immutable after creation (read-only in edit) (`ProjectFormDialog.test.tsx:200`; `e2e/projects/projects-crud.spec.ts:222`).
2. [Confirmed] Create sends selected collections as `initialSources` with `kind:"airweave_collection"` (`ProjectFormDialog.test.tsx:130`).
3. [Confirmed] Non-superadmins see collections filtered to `org.metadata.allowedAirweaveCollectionIds`; superadmins see all (`ProjectFormDialog.test.tsx:173,186`).
4. [Confirmed] Edit diffs sources: only changed collections are added/removed; name unchanged → no `updateProject` call (`ProjectFormDialog.test.tsx:200`).
5. [Unconfirmed] Database-source attach/detach works — the UI supports it but it is not unit-tested (§9).

## 5. Affected areas

- `src/features/Projects/{views,components,hooks,services,types}/*` — ProjectsPage, ProjectFormDialog, `useProjects`, `projectsService`.
- Cross-feature: links SQL connections (SPEC-003) + Airweave collections (SPEC-004); scopes Chat (SPEC-005).
- API: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `POST/DELETE /api/projects/:id/sources[/:sourceId]` (counterpart `api-velocity#SPEC-006`).

## 6. Acceptance criteria (mapped to existing tests)

| # | Criterion | Proving test |
|---|---|---|
| AC1 | Projects render in rows (name/description/source-count/created); empty state when none | `ProjectsPage.test.tsx:133`; `e2e/projects/projects-crud.spec.ts:184,193` |
| AC2 | Search filters rows by name/description and resets the page index | `ProjectsPage.test.tsx:139` |
| AC3 | Create: name + selected collections → POST with `initialSources` (airweave_collection) | `ProjectFormDialog.test.tsx:130`; `e2e/projects/projects-crud.spec.ts:205` |
| AC4 | Single-org non-superadmin sees no org picker (auto-org); multi-org member can target a non-active org | `ProjectFormDialog.test.tsx:165`; `e2e/shared/multi-org-create-project.spec.ts:105` |
| AC5 | Collections filtered to the org allowlist for non-superadmins; superadmin sees all | `ProjectFormDialog.test.tsx:173,186` |
| AC6 | Edit: organization disabled; sources diffed (add Beta / remove Alpha); unchanged name → no update call | `ProjectFormDialog.test.tsx:200`; `e2e/projects/projects-crud.spec.ts:222` |
| AC7 | Delete via row action + confirmation → DELETE with `{id, organizationId}`; toast | `ProjectsPage.test.tsx:161`; `e2e/projects/projects-crud.spec.ts:259` |
| AC8 | Load failure shows an error banner | `ProjectsPage.test.tsx:184` |
| AC9 | Superadmin sees New-project button; Projects nav link present | `e2e/projects/projects-permissions.spec.ts:51,59` |

## 7. Implementation plan

N/A — backfill. Future Projects changes update this spec first (esp. closing the DB-source test gap, §9).

## 8. Testing plan

Unit/component: `src/features/Projects/{views,components}/__tests__/`. e2e: `e2e/projects/*`, `e2e/shared/multi-org-create-project.spec.ts`. Run `npx vitest run src/features/Projects`.

## 9. Risks & failure modes

- **Database-source attach/detach: unverified.** The form wires DB sources (add/remove diff) but only the collection path is unit-tested. Highest-value gap → next change should add a DB-source test.
- External sources are a type only (no UI/flow).
- Form-submission errors (create/update/addSource failures) are not asserted; only the list-load error banner is.
- FE permission affordances are UX; the api is the authority (403 is the real gate).

## 10. Open questions

- Should the org-target + allowlist contract be owned by `api-velocity#SPEC-006` as the SSoT the FE renders?

## Change Log

- 2026-06-04 · PR (backfill) · created · documents current Projects behavior; 9 ACs mapped to existing component + e2e tests; DB-source gap flagged.
