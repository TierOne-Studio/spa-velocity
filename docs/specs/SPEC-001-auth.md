---
id: SPEC-001
title: "SPEC-001: Authentication, session & route-guard behavior"
status: Implemented
layer: ui
owner: Mariano Ravinale
created: 2026-06-04
updated: 2026-06-04
feature_paths:
  - src/features/Auth
  - src/shared/context/AuthContext.tsx
  - src/shared/context/PermissionsContext.tsx
  - src/shared/components/ProtectedRoute.tsx
  - src/shared/components/AdminRoute.tsx
  - src/shared/lib/auth-client.ts
  - src/shared/lib/fetch-with-auth.ts
  - src/shared/lib/auth-storage.ts
  - src/shared/hooks/useEffectiveSession.ts
related_adrs: [ADR-007]
related_specs: []
counterpart_spec: "api-velocity#SPEC-001"
coordination_doc: ""
---

# SPEC-001: Authentication, session & route-guard behavior

> **Backfill** — documents the *current, test-backed* behavior of the Auth feature (not a new
> change). Acceptance criteria map to existing tests. Behaviors with thin/no coverage are listed
> as out-of-scope or unverified, not invented.

## 1. Summary (intended behavior)

Email/password authentication via better-auth with a **bearer token in `localStorage.bearer_token`**
(ADR-007). Users sign up → land in a **pending-approval** gate → once approved, access is governed
by **route guards** (`<ProtectedRoute>` for auth+approval, `<AdminRoute>` for RBAC permissions).
Supporting flows: email verification, forgot/reset password, invitation acceptance, logout, and
role normalization (superadmin > admin > manager > member).

## 2. Context & problem

This feature is the app's trust boundary. It was undocumented; this spec captures the contract so
future changes move the spec with the behavior. The bearer-token-over-cookies choice is load-bearing
(ADR-007): `fetchWithAuth` omits credentials so cookies never conflict with the bearer.

## 3. Scope

**In scope:** login, signup, logout, email verification, forgot/reset password, pending-approval,
account-rejected, invitation acceptance, bearer-token lifecycle, session/approval fetching, role
normalization, `<ProtectedRoute>` + `<AdminRoute>` guard behavior, permission-gated routes.

**Out of scope / non-goals (present in UI or types but NOT implemented/tested):** Google OAuth
(buttons exist, flow not implemented), 2FA, "remember me", user-ban enforcement UI, explicit
expired-session re-auth flow, concurrent-session handling, real email deliverability (mocked in tests).

## 4. Assumptions

1. [Confirmed] Bearer token is the auth credential; cookies are intentionally omitted (ADR-007; `fetch-with-auth.test.ts`).
2. [Confirmed] Approval gating is orthogonal to role: `approvalStatus ∈ {pending, approved, rejected}` gates access; role governs RBAC.
3. [Confirmed] Approval fetch fails **closed** (treated as pending) on 401 (`AuthContext.test.tsx`).
4. [Confirmed] Role may arrive as string, CSV, or array and is normalized to the highest privilege.

## 5. Affected areas

- `src/features/Auth/views/*` — LoginPage, SignupPage, VerifyEmailPage, ForgotPasswordPage, SetNewPasswordPage, PendingApprovalPage, AccountRejectedPage, AcceptInvitationPage.
- `src/shared/context/AuthContext.tsx` — session, role normalization, approval status, `useAuth()`.
- `src/shared/context/PermissionsContext.tsx` — `can(resource, action)`, superadmin bypass.
- `src/shared/components/ProtectedRoute.tsx`, `AdminRoute.tsx` — guards.
- `src/shared/lib/{auth-client,fetch-with-auth,auth-storage}.ts`, `src/shared/hooks/useEffectiveSession.ts`.
- **API endpoints consumed** (see counterpart `api-velocity#SPEC-001`): better-auth `sign-in/sign-up/sign-out/get-session/verify-email/reset-password`, `GET /api/admin/users/me/approval-status`, RBAC `my-permissions`, organization set-active/list.

## 6. Acceptance criteria (falsifiable; mapped to existing tests)

| # | Criterion (observable behavior) | Proving test |
|---|---|---|
| AC1 | Invalid email format blocks submit + shows validation error | `Auth/views/__tests__/LoginPage.test.tsx:47` |
| AC2 | Valid credentials call the login API | `LoginPage.test.tsx:65` |
| AC3 | Login error surfaces a toast; non-Error → "Login failed" fallback | `LoginPage.test.tsx:87,106` |
| AC4 | Already-authenticated user hitting /login → redirect to `/` | `LoginPage.test.tsx:125` |
| AC5 | Pending invitation in sessionStorage → redirect to accept-invitation | `LoginPage.test.tsx:142,162`; `e2e/auth/auth-invitation-flow.spec.ts:57` |
| AC6 | Successful signup creates a `member` and follows the configured post-signup redirect | `e2e/auth/auth.spec.ts:28` |
| AC7 | Signup password mismatch → error toast | `e2e/auth/auth-lifecycle.spec.ts:12` |
| AC8 | Forgot-password submit → success state; "Try another email" returns to form | `e2e/auth/auth-lifecycle.spec.ts:70,109` |
| AC9 | Reset password: no token → invalid link; mismatch → error; success → redirect to /login | `e2e/auth/auth.spec.ts:200,216`; `auth-lifecycle.spec.ts:190` |
| AC10 | Verify email: no token → error; with token → verification state | `e2e/auth/auth.spec.ts:229,235` |
| AC11 | Logout calls `signOut()` + `clearAuthStorage()`, clears bearer tokens, redirects to /login | `AuthContext.test.tsx:301`; `e2e/auth/auth.spec.ts:256,300` |
| AC12 | Bearer token: stored from `set-auth-token` header on success; absent header → not stored | `auth-client.test.ts:66,79`; `e2e/auth/auth.spec.ts:374` |
| AC13 | `fetchWithAuth` adds `Authorization: Bearer` iff a token exists; omits credentials | `fetch-with-auth.test.ts:28,45,66` |
| AC14 | Role normalization: admin/superadmin/manager/member, CSV, array, undefined → highest/member | `AuthContext.test.tsx:68–143` |
| AC15 | `<ProtectedRoute>`: loading → spinner; unauth → /login; pending → /pending-approval; rejected → /account-rejected; approved → children | `ProtectedRoute.test.tsx:21,34,64,82`; `e2e/auth/auth.spec.ts:244` |
| AC16 | `<AdminRoute>`: unauth → /login; permission denied → fallback (default `/`); granted → children | `AdminRoute.test.tsx:39,52,67,81,95` |
| AC17 | Pending-approval: "Check Status" refreshes; approved → `/`; rejected → /account-rejected; logout → /login | `PendingApprovalPage.test.tsx:46,56,69,81` |
| AC18 | Approval fetch fails closed to pending on 401; auth stays loading until approval resolves | `AuthContext.test.tsx:511,546` |

## 7. Implementation plan

N/A — backfill of existing behavior. Future changes to Auth update this spec first (per the spec-first workflow).

## 8. Testing plan

Existing coverage is the contract: component tests under `src/features/Auth/views/__tests__/` +
`src/shared/{context,components,lib,hooks}/__tests__/`, and e2e under `e2e/auth/`
(`auth.spec.ts`, `auth-lifecycle.spec.ts`, `auth-invitation-flow.spec.ts`). Run:
`npx vitest run src/features/Auth src/shared/context src/shared/components src/shared/lib` and
`npm run test:e2e:isolate:auth`.

## 9. Risks & failure modes

- **Expired session:** no explicit re-auth UI; relies on guard re-evaluation when a 401 fails the auth check. **Unverified** — no dedicated test.
- **OAuth buttons present but non-functional** — risk of user confusion; out of scope until implemented.
- Approval-status endpoint failure → fails closed (pending), which is the safe direction (AC18).
- Bearer-in-localStorage is XSS-readable (ADR-007 trade-off); mitigated by the SPA's no-`dangerouslySetInnerHTML` posture.

## 10. Open questions

- Should the OAuth buttons be hidden until the flow ships? (Product decision; tracked as out-of-scope here.)
- Does the api counterpart (`api-velocity#SPEC-001`) want to own the approval state-machine contract, or this spec? (Resolve when authoring the api side.)

## Change Log

- 2026-06-04 · PR (backfill) · created · documents existing Auth behavior; 18 ACs mapped to existing component + e2e tests.
