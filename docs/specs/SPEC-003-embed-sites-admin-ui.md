---
id: SPEC-003
title: "SPEC-003: Public Widget (embed sites) admin UI"
status: Draft
layer: ui
owner: Maxi Schvindt
created: 2026-06-23
updated: 2026-06-30
feature_paths:
  - src/features/EmbedSites
related_adrs: [ADR-002, ADR-005]
related_specs: []
counterpart_spec: "api-velocity#SPEC-003"
coordination_doc: ""
---

# SPEC-003: Public Widget (embed sites) admin UI

## 1. Summary (intended behavior)

Org admins can manage the embed sites that power the public web chat widget from
a first-class "Public Widget" area in the admin app. From a single page they
create an embed site (name + project + allowed origins), edit it, rotate its
publishable key, delete it, and copy the ready-to-paste `<script>` embed snippet.
The page and its navigation entry are gated on the `embed-site:read` permission;
mutating actions are driven by the `embed-site:{create,update,delete}` scopes
enforced server-side. This is the SPA counterpart of the api-velocity SPEC-003
public web chat widget contract (Slice 2 — admin surface, plus Slice 3 widget
theming preview).

## 2. Context & problem

api-velocity SPEC-003 introduced anonymous embed-site authentication, per-site
publishable keys, and an origin allowlist, but exposed only a backend CRUD API.
Without an admin UI an operator would have to call the API by hand to provision a
widget, generate a key, or rotate a leaked one. This spec governs the admin
surface that consumes that API. The feature lives entirely under
`src/features/EmbedSites`, following the existing feature-module conventions
(TanStack Query for server state — ADR-002; react-hook-form + Zod for forms —
ADR-005).

## 3. Scope

**In scope:**

- A `/embed-sites` route ("Public Widget") behind `AdminRoute` requiring
  `embed-site:read`, plus a sidebar nav entry gated on the same permission.
- `EmbedSitesPage` listing the org's embed sites with per-row actions.
- Five dialogs: create, edit, delete (confirm), rotate key (confirm), and embed
  code (snippet + copy-to-clipboard).
- A typed service + TanStack Query hooks (list query; create/update/rotate/delete
  mutations) with cache invalidation on success.
- A typed `{ data }` API-envelope parser that fails closed on malformed bodies.
- Free-text allowed-origins parsing + fail-fast origin validation at the form
  boundary, and a Zod schema wiring that validation into the forms.
- A widget theme preview mirroring the api-side preset palettes.

**Out of scope / non-goals:**

- The public widget runtime/bundle itself (served by api-velocity).
- Anonymous public chat, CORS, throttling, and source allowlisting (api-velocity
  SPEC-003 contract — server-side).
- Server-side RBAC scope definitions and persistence (api-velocity).
- Multi-project-per-site or multiple sites per project (the backend enforces a
  1:1 site↔project invariant).

## 4. Assumptions

1. [Confirmed] The API wraps success bodies as `{ data: T }` and error bodies
   carry a `{ message }` field, consistent with sibling features (VectorDb,
   Airweave).
2. [Confirmed] The backend enforces org scoping and the
   `embed-site:{read,create,update,delete}` permission matrix; the UI gates are a
   usability layer, not the security boundary.
3. [Confirmed] An allowed origin is an `http(s)` scheme + host with no
   credentials and no path/query/hash (mirrors the server normalization).
4. [Confirmed] Rotating a key invalidates the previous key on the public channel
   immediately (server contract); the UI only surfaces the new key.

> Correct any Unconfirmed assumption now, or implementation proceeds on it.

## 5. Affected areas

- `src/features/EmbedSites/views/EmbedSitesPage.tsx` — page + dialog state.
- `src/features/EmbedSites/components/*` — Create/Edit/Delete/RotateKey/EmbedCode
  dialogs + widget preview.
- `src/features/EmbedSites/hooks/*` — `useEmbedSites`, `useEmbedSiteMutations`,
  `embedSiteKeys`.
- `src/features/EmbedSites/services/embedSitesService.ts` — REST calls.
- `src/features/EmbedSites/lib/{apiResponse,origins}.ts` — envelope + origin
  helpers.
- `src/features/EmbedSites/schemas/embedSiteSchema.ts` — Zod create/edit schemas.
- Routes/guards: `src/app/views/AppRoutes.tsx` (`embed-sites` behind
  `AdminRoute` / `embed-site:read`).
- Nav: `src/shared/components/ui/app-sidebar.tsx` ("Public Widget", gated on
  `can("embed-site","read")`).
- API endpoints consumed: `GET/POST/PATCH/DELETE /api/embed-sites`,
  `POST /api/embed-sites/:id/rotate-key`.

## 6. Acceptance criteria (falsifiable; each maps to a test)

| # | Criterion (observable behavior) | Proving test (file) |
|---|---|---|
| AC1 | The "Public Widget" sidebar entry renders only when the user has `embed-site:read` | `src/shared/components/ui/__tests__/app-sidebar.test.tsx` |
| AC2 | `EmbedSitesPage` shows the create action only with `embed-site:create`; otherwise read-only | `src/features/EmbedSites/views/__tests__/EmbedSitesPage.test.tsx` |
| AC3 | The create form rejects an empty name, missing project, or an invalid origin | `src/features/EmbedSites/schemas/__tests__/embedSiteSchema.test.ts`, `src/features/EmbedSites/components/__tests__/CreateEmbedSiteDialog.test.tsx` |
| AC4 | Each successful mutation invalidates `embedSiteKeys.all` | `src/features/EmbedSites/hooks/__tests__/useEmbedSiteMutations.test.ts` |
| AC5 | The service unwraps `{ data }` and throws `EmbedSiteApiError` on a non-ok or malformed (no-`data`) body | `src/features/EmbedSites/services/__tests__/embedSitesService.test.ts`, `src/features/EmbedSites/lib/__tests__/apiResponse.test.ts` |
| AC6 | The embed-code dialog builds the `<script>` snippet and copies it to the clipboard | `src/features/EmbedSites/components/__tests__/EmbedCodeDialog.test.tsx` |
| AC7 | `isValidOrigin` rejects path/query/hash, non-http(s) schemes, and credentialed URLs | `src/features/EmbedSites/lib/__tests__/origins.test.ts` |
| AC8 | A signed-in admin sees the nav entry, opens the page, and the create dialog exposes name/project/origins fields | `e2e/embed-sites/embed-sites.spec.ts` |

## 7. Implementation plan

1. Types + lib helpers (`types/index.ts`, `lib/apiResponse.ts`, `lib/origins.ts`).
   `tests:` `origins.test.ts`, `apiResponse.test.ts`. `risk:` envelope/origin
   parsing edge cases. `slice:` foundation, no UI.
2. Service + query keys + hooks (`services/embedSitesService.ts`,
   `hooks/*`). `tests:` `embedSitesService.test.ts`,
   `useEmbedSiteMutations.test.ts`. `risk:` cache invalidation correctness.
3. Zod schemas (`schemas/embedSiteSchema.ts`). `tests:`
   `embedSiteSchema.test.ts`. `risk:` origin refinement wiring.
4. Dialog components + widget preview (`components/*`). `tests:` per-dialog specs.
   `risk:` form/mutation/toast wiring; clipboard.
5. Page + route + nav (`views/EmbedSitesPage.tsx`, `AppRoutes.tsx`,
   `app-sidebar.tsx`). `tests:` `EmbedSitesPage.test.tsx`,
   `app-sidebar.test.tsx`. `risk:` permission gating.
6. E2E (`e2e/embed-sites/embed-sites.spec.ts`). `risk:` real-backend admin
   membership setup. `slice:` end-to-end proof.

## 8. Testing plan

- Unit/component (Vitest + Testing Library): lib helpers, service, hooks,
  schemas, every dialog, the page, and the sidebar — file list in §6.
- E2E (Playwright, `e2e/embed-sites/embed-sites.spec.ts`): nav visibility, page
  render, and create-dialog fields against a real backend with admin membership.

## 9. Risks & failure modes

- **Malformed API body:** a 2xx without `{ data }` previously returned
  `undefined` silently — now fails closed with `EmbedSiteApiError` (AC5).
- **Bad origin input:** credentialed / path-bearing origins are rejected at the
  form boundary so they never round-trip (AC7).
- **Stale list after mutate:** mutations invalidate `embedSiteKeys.all` so the
  table refetches (AC4).
- **Permission drift:** UI gates mirror but do not replace server RBAC; a missing
  client gate degrades to a server 403, never silent cross-org access.
- **Clipboard unavailable:** copy failure surfaces an error toast rather than a
  thrown exception.

## 10. Open questions

None blocking v1. Future: surface per-site monthly-usage counters once the API
exposes them; inline live widget preview using the actual served bundle.

## Change Log

Append-only. Newest first.

- 2026-06-30 · PR #34 · Initial SPA spec for the Public Widget admin UI;
  documents the embed-sites CRUD surface, RBAC gating, envelope/origin helpers,
  and dialog set. Counterpart of api-velocity#SPEC-003 (Slices 2–3). Authored to
  pair the behavioral change with its governing spec (spec-gate).
