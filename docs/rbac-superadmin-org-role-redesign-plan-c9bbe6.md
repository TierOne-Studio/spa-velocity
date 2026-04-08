# MVP Foundation + RBAC Superadmin + Org-Scoped Roles Redesign

This plan assumes the real MVP foundation is already decided: the product is a chat linked directly to one Airweave collection per organization. The RBAC redesign exists to support that smaller product cleanly, not to preserve the older project-scoped runtime model.

## Product baseline

- one Airweave collection per organization
- private conversations per user
- no user-facing Projects page
- no user-facing Data Sources page
- Airweave source connection setup stays outside the product for now

Step 0 is therefore the foundation of the whole document:

- the user enters chat through the active organization
- the backend resolves the collection from `organization.metadata.airweaveCollectionId`
- chat no longer depends on `projectId`
- project-scoped routes, selectors, and services are removed rather than polished

## Target model

- `superadmin` is the only global/session role.
- `superadmin` bypasses all permission checks and sees all organizations and users.
- `admin`, `manager`, and `member` are organization-scoped roles only.
- Default org roles are seeded for every organization: `admin`, `manager`, `member`.
- Custom org roles are allowed.
- Current permission catalog is preserved for this pass:
  - `organization:create|read|update|delete|invite`
  - `role:create|read|update|delete|assign`
  - `session:read|revoke`
  - `user:create|read|update|delete|ban|impersonate|set-role|set-password`
- `organization:create` remains a normal permission and defaults to org `admin`.
- Organization creators become org `admin` in the new organization.
- Anti-escalation rule: users may create, edit, or assign only roles whose permissions are a subset of their own effective permissions.
- The surviving SPA shell is organization-scoped chat plus admin/org management, not project workspaces.

## Non-goals

- No permission renaming in this pass.
- No UI redesign beyond removing obsolete MVP surfaces.
- No Git actions.
- No manual DB edits outside migration/seeding code.
- No preservation of user-facing Projects/Data Sources flows.

## Acceptance criteria

- Current global `admin` users are migrated to `superadmin`.
- No backend guard or service grants unrestricted access to `admin`, `manager`, or `member` based solely on session role.
- Effective permissions for non-`superadmin` users come from active-organization membership role permissions.
- Existing and newly created organizations have default `admin`, `manager`, `member` roles with the approved default permission matrix.
- Org `admin` can create organizations and becomes org `admin` of each created org.
- Chat resolves against the active organization collection without a project selector.
- Projects/Data Sources routes and sidebar entries are removed from the user-facing MVP.
- Frontend route gating, sidebar visibility, page actions, and roles UI reflect the new effective-permissions model.
- Regression tests cover MVP chat access, guard behavior, migration/seeding, org creation, role management anti-escalation, and core admin UI/E2E flows.

## Working set / main files

### Backend
- `api-ampliri/src/modules/chat/api/controllers/chat.controller.ts`
- `api-ampliri/src/modules/chat/application/services/chat.service.ts`
- `api-ampliri/src/modules/chat/infrastructure/persistence/repositories/chat.database-repository.ts`
- `api-ampliri/src/modules/airweave/api/controllers/airweave.controller.ts`
- `api-ampliri/src/modules/admin/organizations/api/controllers/admin-organizations.controller.ts`
- `api-ampliri/src/modules/admin/organizations/application/services/admin-organizations.service.ts`
- `api-ampliri/src/shared/guards/permissions.guard.ts`
- `api-ampliri/src/shared/guards/permissions.guard.spec.ts`
- `api-ampliri/src/modules/admin/users/utils/admin.utils.ts`
- `api-ampliri/src/modules/admin/rbac/api/controllers/rbac.controller.ts`
- `api-ampliri/src/modules/admin/rbac/application/services/role.service.ts`
- `api-ampliri/src/modules/admin/rbac/rbac.migration.ts`
- `api-ampliri/src/modules/admin/users/api/controllers/admin-users.controller.ts`
- `api-ampliri/src/modules/admin/users/application/services/admin.service.ts`
- `api-ampliri/src/modules/admin/sessions/api/controllers/sessions.controller.ts`
- `api-ampliri/src/modules/admin/sessions/application/services/sessions.service.ts`
- `api-ampliri/src/modules/projects/**` (detach, then remove)

### Frontend
- `spa-ampliri/src/app/views/AppRoutes.tsx`
- `spa-ampliri/src/shared/components/ui/app-sidebar.tsx`
- `spa-ampliri/src/features/Chat/views/ChatPage.tsx`
- `spa-ampliri/src/features/Chat/hooks/useChat.ts`
- `spa-ampliri/src/features/Chat/services/chatService.ts`
- `spa-ampliri/src/shared/context/AuthContext.tsx`
- `spa-ampliri/src/shared/context/PermissionsContext.tsx`
- `spa-ampliri/src/shared/components/AdminRoute.tsx`
- `spa-ampliri/src/features/Admin/services/rbacService.ts`
- `spa-ampliri/src/features/Admin/services/adminService.ts`
- `spa-ampliri/src/features/Admin/hooks/useRoles.ts`
- `spa-ampliri/src/features/Admin/hooks/useOrganizations.ts`
- `spa-ampliri/src/features/Admin/views/RolesPage.tsx`
- `spa-ampliri/src/features/Admin/views/UsersPage.tsx`
- `spa-ampliri/src/features/Admin/views/OrganizationsPage.tsx`
- `spa-ampliri/src/features/Projects/**` (removal)
- `spa-ampliri/src/features/DataSources/**` (removal)
- `spa-ampliri/e2e/rbac-roles-matrix.spec.ts`
- `spa-ampliri/e2e/rbac-users-matrix.spec.ts`

## TDD execution strategy

### Step 0 - Establish the MVP foundation first
Goal: make the product shell match the real MVP before deeper RBAC cleanup.

Tests first:
- Add/update route and navigation tests proving Projects/Data Sources disappear from the shell.
- Add/update chat page tests proving active-organization chat works without `projectId` selection.
- Add/update service tests proving chat requests use organization-scoped contracts only.

Implementation:
- Remove user-facing Projects/Data Sources routes, sidebar items, and page-level dependencies.
- Refactor `ChatPage`, `useChat`, and `chatService` away from project-scoped request parameters.
- Consume the organization-scoped collection contract exposed by the backend instead of project state.

Regression goal:
- The SPA shell reflects the actual MVP before any later role/permission work proceeds.

### Step 1 - Lock the permission-resolution contract
Goal: replace old platform-role authorization with `superadmin` bypass + active-org permission resolution.

Tests first:
- Update `permissions.guard.spec.ts`:
  - `superadmin` bypasses without consulting role permissions
  - org-scoped users require active org + resolved permissions
  - missing active org denies protected org-scoped routes
- Add service-level tests around permission resolution entry points if missing.

Implementation:
- Refactor `admin.utils.ts` to represent the new global role model.
- Move permission lookup away from `roleName` only and toward active-org membership role resolution.
- Keep error messages explicit and fail fast.

Regression goal:
- Guard behavior is stable before touching controllers/services broadly.

### Step 2 - Introduce migration + seed defaults safely
Goal: migrate old data and seed org-scoped default roles without breaking current org memberships.

Tests first:
- Add/extend migration or repository tests for:
  - converting global `admin` -> `superadmin`
  - seeding per-org `admin|manager|member`
  - preserving existing member-role assignments
  - ensuring new orgs receive default roles

Implementation:
- Update `rbac.migration.ts` to:
  - add `superadmin`
  - migrate user role values
  - stop treating org defaults as global system roles with `organization_id = NULL`
  - seed default role-permission mappings per organization
- Ensure fresh org creation seeds roles idempotently.

Regression goal:
- Existing orgs and memberships remain usable after migration.

### Step 3 - Refactor organization creation + membership flows
Goal: make org creation and org-role assignment follow the new model.

Tests first:
- Extend `admin-organizations.controller.spec.ts` and service tests for:
  - creator becomes org `admin`
  - org `admin` with `organization:create` can create a new org
  - membership role updates/removals respect active org and last-admin protection
  - anti-escalation subset rule for assignable roles/permissions

Implementation:
- Update `AdminOrganizationsService` to seed default roles during org creation.
- Replace hierarchy-based assignment checks with permission-subset checks where applicable.
- Keep last-admin protection intact.

Regression goal:
- Org creation and membership management continue working while moving away from hardcoded role hierarchy.

### Step 4 - Refactor user/sessions/admin services away from platform `admin|manager|member`
Goal: make user/session operations org-scoped by permission, not by legacy global role shortcuts.

Tests first:
- Add focused unit/integration coverage for `AdminService` and `SessionsService`:
  - org `admin` can use `user:delete|ban|impersonate|set-password`
  - org actor can only affect users visible in the active organization
  - `superadmin` bypasses org restrictions
  - non-`superadmin` cannot act without active org context where required

Implementation:
- Refactor `admin.service.ts`, `sessions.service.ts`, and affected controllers to use:
  - `superadmin` as the only unrestricted actor
  - org membership scope for all other actors
- Remove assumptions that global `admin` means unrestricted access.
- Reinterpret `user:set-role` as org-role assignment, not global role mutation.

Regression goal:
- Existing user-management screens keep functioning with narrower, explicit rules.

### Step 5 - Enforce subset-rule role governance
Goal: prevent privilege escalation while keeping custom roles fully permission-driven.

Tests first:
- Add RBAC controller/service tests for:
  - creating a custom role with permission superset is rejected
  - editing permissions to exceed actor permissions is rejected
  - assigning a role to a user/member is rejected if the role exceeds actor permissions
  - `superadmin` can bypass subset checks

Implementation:
- Add effective-permission comparison helpers in RBAC service/repository layer.
- Validate role create/update/assign flows before persistence.

Regression goal:
- Custom roles remain flexible without introducing escalation paths.

### Step 6 - Frontend permission model alignment
Goal: make the SPA reflect backend-effective permissions for the active organization and the chat-first MVP shell.

Tests first:
- Add/update unit tests for `PermissionsContext`, `AdminRoute`, and affected hooks/pages.
- Add regressions for:
  - no active org state on org-scoped pages
  - chat availability without project selection
  - org `admin` visibility for create org / role management / user actions
  - roles page rendering seeded default org roles correctly

Implementation:
- Update `rbacService.getMyPermissions()` consumers and query invalidation rules.
- Ensure `PermissionsContext` responds correctly to auth and active-org changes.
- Keep chat entry points aligned with active-organization scope rather than project state.
- Update `UsersPage`, `OrganizationsPage`, and `RolesPage` assumptions about role sources and role labels.
- Keep sidebar and route visibility driven strictly by `can(resource, action)`.

Regression goal:
- No route-sticking or stale-permission UI after org switch or role changes.

### Step 7 - End-to-end verification and regression pass
Goal: prove the redesigned model works across real user journeys.

Verification sequence:
- targeted Jest files during backend steps
- targeted Vitest files during frontend steps
- full backend unit suite after backend milestones
- full frontend unit suite after frontend milestones
- focused Playwright coverage after both repos are green

Expected E2E assertions:
- `superadmin` sees all admin sections without org context blockers
- org `admin` can manage users, sessions, roles, and create organizations
- authenticated users reach chat through active-organization scope without any project picker
- org `manager` and `member` match the approved default matrix
- switching active organization changes effective permissions and visible UI correctly

## Default permission matrix to implement

### `superadmin`
- bypasses all checks
- no permission filtering restrictions

### Org `admin`
- all current catalog permissions by default

### Org `manager`
- `organization:read`
- `organization:update`
- `organization:invite`
- `role:read`
- `session:read`
- `session:revoke`
- `user:create`
- `user:read`
- `user:update`

### Org `member`
- `organization:read`

### MVP rule
- No project-scoped permissions or UI affordances should remain in the surviving MVP shell.

## High-risk areas

- `ChatPage`, chat hooks, and chat API contracts are still project-scoped in the current implementation.
- `AdminService` and `AdminOrganizationsService` currently encode role hierarchy and platform-role assumptions.
- `PermissionsGuard` currently resolves permissions by global role name, not active-org membership.
- `rbac.migration.ts` currently seeds global system roles instead of per-org defaults.
- Frontend E2E fixtures currently assume users are globally `admin|manager|member`.
- `user:set-role` semantics must change carefully to avoid breaking UI/API expectations.

## Execution order rationale

- Step 0 first, because the chat-linked-to-collection MVP is the actual product baseline.
- Guard/permission contract next, once the shell matches the target product.
- Migration/seeding after that.
- Org creation and assignment next.
- User/session services after backend authorization rules stabilize.
- Frontend alignment after backend contract stabilizes.
- E2E only after both repos are green.

## Done definition

- All targeted failing tests written first and passing after minimal implementation.
- No remaining hardcoded `admin` bypass outside `superadmin` logic.
- No remaining code path where org-scoped authorization is derived only from global session role.
- No remaining user-facing dependency on Projects/Data Sources for the simplified MVP.
- Chat is linked directly to the organization collection without project selection.
- No regression in admin navigation, org switching, or roles page rendering.
