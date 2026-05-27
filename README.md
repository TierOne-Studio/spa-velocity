# spa-velocity

A production-ready **React 19 + Vite 7** SPA with **Better Auth**, **RBAC**, **admin panel**, **multi-tenant organizations**, **AI chat**, **projects / SQL connections**, and **Airweave knowledge ingestion**.

Companion backend: **[api-velocity](../api-velocity)** (sibling directory).

---

## Table of Contents

- [Onboarding](#onboarding)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Routing & RBAC](#routing--rbac)
- [Feature Modules](#feature-modules)
- [State Management](#state-management)
- [API Client & Auth](#api-client--auth)
- [Forms & Validation](#forms--validation)
- [Styling & Theming](#styling--theming)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [ADRs](#adrs)
- [Companion Backend](#companion-backend)
- [Technology Stack](#technology-stack)

---

## Onboarding

`spa-velocity` is the React SPA that consumes the `api-velocity` NestJS backend. The two repos are expected to live side-by-side:

```
~/Repositories/Github/
├── api-velocity/   ← NestJS API (port 3000)
└── spa-velocity/   ← this repo (port 5173)
```

### What this SPA gives you

- **Auth flows** — login, signup, email verification, password reset, invitation acceptance, pending-approval and account-rejected pages.
- **Admin panel** — Users, Sessions, Organizations, Roles & Permissions, an admin dashboard.
- **Org-scoped product surfaces** — AI Chat, Projects, Airweave collections + OAuth source connections.
- **Permission-based navigation** — sidebar and routes are gated by `{ resource, action }` permissions, not just role names.
- **Themed UI** — Tailwind v4 + Radix + shadcn/ui + `next-themes` for light/dark/system.

### Where to start reading

1. `src/app/views/AppRoutes.tsx` — provider stack + route tree.
2. `src/shared/context/AuthContext.tsx` — auth state machine, approval gating.
3. `src/shared/context/PermissionsContext.tsx` — RBAC checks consumed by `<AdminRoute>`.
4. `src/shared/lib/fetch-with-auth.ts` — the single API client (reads `localStorage["bearer_token"]`).
5. `src/features/<feature>/` — feature-folder layout (one folder per domain).
6. `docs/decisions/` — load-bearing ADRs (see [ADRs](#adrs)).

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x
- A running **[api-velocity](../api-velocity)** backend on `http://localhost:3000`.

### 1. Start the backend

```bash
cd ../api-velocity
npm install
npm run start:dev   # port 3000
```

### 2. Install & run the SPA

```bash
cd spa-velocity
npm install
npm run dev         # port 5173
```

Open **<http://localhost:5173>**.

### 3. Log in

Use the seeded test admin:

```
email:    delivered+e2e-test-user@resend.dev
password: password123
```

(Seeded by `api-velocity`'s `002_create_test_admin.sql`.)

---

## Architecture

### Layout

```
src/
├── app/
│   └── views/
│       ├── AppRoutes.tsx              # Provider stack + route tree
│       └── RootLayout.tsx             # Sidebar + outlet
│
├── features/                          # One folder per domain
│   ├── Auth/                          # Login, signup, verify, reset, invitations
│   ├── Dashboard/                     # User-level settings / account
│   ├── Admin/                         # Users, Sessions, Organizations, Roles
│   ├── AdminDashboard/                # Admin-only aggregate dashboard
│   ├── Chat/                          # Org-scoped AI chat
│   ├── Projects/                      # Project workspace CRUD
│   └── Airweave/                      # Collections + OAuth source connections
│
├── shared/
│   ├── components/
│   │   ├── ui/                        # shadcn/ui primitives (Radix + CVA)
│   │   ├── AdminRoute.tsx             # Permission-gated route guard
│   │   ├── ProtectedRoute.tsx         # Authenticated-only guard
│   │   └── ThemeProvider.tsx          # next-themes wrapper
│   ├── context/
│   │   ├── AuthContext.tsx            # Auth state + actions
│   │   └── PermissionsContext.tsx     # RBAC checks
│   ├── hooks/                         # useOrgRole, useIsImpersonating, etc.
│   ├── lib/
│   │   ├── auth-client.ts             # Better Auth client
│   │   └── fetch-with-auth.ts         # API client + bearer injection
│   └── store/
│       └── store.ts                   # Minimal Zustand store (theme)
│
└── test/
    └── setup.ts                       # Vitest setup, mocks
```

`e2e/` (sibling of `src/`) holds Playwright specs grouped by domain.

### Per-feature layout

Each `features/<Domain>/` folder follows the repo convention:

```
<Domain>/
├── views/         # Pages (route components)
├── components/    # Feature-scoped components
├── hooks/         # TanStack Query hooks
├── services/      # API service modules (use fetchWithAuth)
├── schemas/       # Zod schemas
└── __tests__/     # Vitest unit + component tests
```

### Provider stack (`AppRoutes.tsx`)

```
ThemeProvider
└── QueryClientProvider (TanStack Query)
    └── BrowserRouter
        └── AuthProvider
            └── PermissionsProvider
                └── <Routes>
```

---

## Routing & RBAC

Routes are defined in `src/app/views/AppRoutes.tsx`. Three protection levels:

| Guard | Effect |
|---|---|
| (none) | Public (auth pages) |
| `<ProtectedRoute>` | Requires an authenticated, approved user |
| `<AdminRoute requiredPermission={{ resource, action }} />` | Requires the permission tuple |

### Route map

#### Public

| Path | Component |
|---|---|
| `/login` | LoginPage |
| `/signup` | SignupPage |
| `/verify-email` | VerifyEmailPage |
| `/forgot-password` | ForgotPasswordPage |
| `/set-new-password` | SetNewPasswordPage |
| `/accept-invitation/:id` | AcceptInvitationPage |
| `/pending-approval` | PendingApprovalPage |
| `/account-rejected` | AccountRejectedPage |

#### Authenticated (under `<RootLayout>`)

| Path | Component | Guard |
|---|---|---|
| `/` | → redirects to `/chat` | ProtectedRoute |
| `/settings` | SettingsPage | ProtectedRoute |
| `/account` | AccountPage | ProtectedRoute |
| `/chat` · `/chat/:conversationId` | ChatPage | AdminRoute (`chat`) |
| `/projects` | ProjectsPage | AdminRoute (`project`) |
| `/admin/dashboard` | AdminDashboardPage | AdminRoute (`dashboard`) |
| `/admin/users` | UsersPage | AdminRoute (`user`) |
| `/admin/sessions` | SessionsPage | AdminRoute (`session`) |
| `/admin/organizations` | OrganizationsPage | AdminRoute (`organization`) |
| `/admin/roles` | RolesPage | AdminRoute (`role`) |
| `/admin/airweave` · `/admin/airweave/:collectionReadableId` | Airweave pages | AdminRoute (`airweave`) |

When permission is denied, `<AdminRoute>` falls back to `/account` rather than throwing.

### Role normalization

`AuthContext` normalizes any incoming backend role to the canonical 3-role model used by the SPA:

```
superadmin → admin
admin      → admin
manager    → manager
member     → member
```

This guarantees `isAdmin`, `isManager`, etc. work regardless of legacy values.

---

## Feature Modules

| Feature | Calls (api-velocity) | Notes |
|---|---|---|
| **Auth** | `/api/auth/*` (Better Auth) | Bearer token persisted to `localStorage`; approval gate via `/api/admin/users/me/approval-status` |
| **Admin/Users** | `/api/admin/users` | Server-paginated table, search, ban/role/password, impersonate |
| **Admin/Sessions** | `/api/admin/users/:userId/sessions` | Revoke single / all |
| **Admin/Organizations** | `/api/platform-admin/organizations` | CRUD, members, invitations, impersonate-into-org |
| **Admin/Roles** | `/api/rbac` | Roles + permissions matrix |
| **AdminDashboard** | `/api/admin/dashboard` | Aggregate counts |
| **Chat** | `/api/chat` | Streaming AI responses; conversation list |
| **Projects** | `/api/projects` + `/api/sql-connections` | Workspace CRUD |
| **Airweave** | `/api/airweave` + `@airweave/connect-react` SDK | Collections list/detail; OAuth source connections via embedded widget (postMessage transport per ADR-011 amendment) |

---

## State Management

Three layers, with strict responsibilities:

| Layer | Tool | Holds |
|---|---|---|
| **Server cache** | TanStack Query 5 | All data fetched from `api-velocity` (users, orgs, conversations, collections…) |
| **Client store** | Zustand 5 (`src/shared/store/store.ts`) | Cross-cutting client state. Currently: theme. |
| **Component state** | `useState` / `useReducer` | Local UI state, form drafts |
| **Auth state** | React Context (`AuthContext`) | Current user, isAuthenticated, isLoading, role flags |
| **RBAC state** | React Context (`PermissionsContext`) | Permission catalog + `hasPermission(resource, action)` |

Bearer token is **not** kept in Zustand or Context — it lives in `localStorage["bearer_token"]` and is read on demand by `fetchWithAuth`.

---

## API Client & Auth

### `fetchWithAuth` (single client)

`src/shared/lib/fetch-with-auth.ts` provides:

- `fetchWithAuth(input, init?)` — wraps `fetch`, injects `Authorization: Bearer <token>` from localStorage, **omits credentials** (no cookies are sent — ADR-007).
- `fetchApi<T>(path, init?)` — convenience wrapper that resolves URL against `VITE_API_URL`, parses JSON, throws on non-2xx, returns `void` on 204.

All feature `services/` modules go through this; there is no second HTTP client.

### Better Auth client

`src/shared/lib/auth-client.ts` configures the `better-auth/client` with the `organization`, `admin`, and `bearer` plugin clients. Used directly only by `AuthContext` for login/signup/signout/session.

### Bearer-token storage

Per ADR-007, the SPA uses `localStorage["bearer_token"]` (not cookies). `fetchWithAuth` sets `credentials: "omit"` so the API sees a pure bearer call — no CSRF surface.

---

## Forms & Validation

Every form follows the same recipe (ADR-005):

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/features/Auth/schemas/authSchemas";

const form = useForm({ resolver: zodResolver(loginSchema) });
```

- **Schemas** live in `src/features/<Domain>/schemas/*.ts`.
- **Inputs** use shadcn/ui primitives (`<Input>`, `<Select>`, `<Checkbox>`, `<Form*>`).
- **Errors** come from `form.formState.errors`; rendered via the shadcn/ui `<FormMessage>`.

---

## Styling & Theming

- **Tailwind v4** via `@tailwindcss/vite`. Theme tokens are CSS variables.
- **shadcn/ui** components under `src/shared/components/ui/`.
- **Radix UI** primitives + `class-variance-authority` (CVA) for variants + `tailwind-merge` for class deduplication via the `cn()` helper.
- **Dark mode** via `next-themes`:
  - `<ThemeProvider>` at the root with `storageKey: "vite-ui-theme"` and `defaultTheme: "system"`.
  - Switch via the theme toggle in the sidebar.

---

## Testing

### Unit tests — Vitest

```bash
npm test                 # full suite + coverage (jsdom)
npm run test:watch       # watch mode
npm test -- --run <path> # single file
```

- ~359 `.test.ts(x)` files across features and shared.
- Coverage thresholds: ≥ 70 % statements / branches / functions / lines (current actuals ~90 %).
- Setup in `src/test/setup.ts` (mocks, polyfills).

### E2E tests — Playwright

```bash
npm run test:e2e         # full headless suite
npm run test:e2e:list    # list discovered tests
npm run test:e2e:headed  # watch them run
npm run test:e2e:ui      # interactive UI
npm run test:e2e:report  # open last HTML report
```

Grouped runs by feature:

```bash
npm run test:e2e:auth
npm run test:e2e:admin
npm run test:e2e:rbac
npm run test:e2e:full-crud
npm run test:e2e:api
```

#### Isolated mode (keep dev servers running)

Uses dedicated ports and a separate database so Playwright never collides with your active dev session:

```bash
npm run test:e2e:isolate
npm run test:e2e:isolate:auth
npm run test:e2e:isolate:admin
```

Isolated defaults:

| Resource | URL |
|---|---|
| API | `http://127.0.0.1:3100` |
| Frontend | `http://127.0.0.1:4173` |
| Database | `postgresql://<user>@localhost:5432/api_velocity_e2e` |

Override per run:

```
E2E_API_BASE_URL
E2E_FE_URL
E2E_DATABASE_URL
E2E_TEST_USER_EMAIL
E2E_TEST_USER_PASSWORD
E2E_REUSE_EXISTING_SERVER
```

56 spec files across `e2e/{auth,admin,airweave,chat,projects,rbac,shared,api,dashboard,admin-dashboard}/`.

---

## Environment Variables

Vite exposes only `VITE_*` vars to the client. Create `.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | api-velocity base URL |
| `VITE_AIRWEAVE_CONNECT_URL` | `https://connect.airweave.ai` | Airweave Connect widget URL consumed by `@airweave/connect-react`. Override for self-hosted Airweave. Per ADR-011 amendment 2: transport is **postMessage**, not URL params (no Referer leak). |

### E2E-only (not bundled)

| Variable | Purpose |
|---|---|
| `E2E_API_BASE_URL` | API URL for Playwright |
| `E2E_FE_URL` | Frontend URL for Playwright |
| `E2E_DATABASE_URL` | Isolated database |
| `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD` | Seeded test user credentials |
| `E2E_REUSE_EXISTING_SERVER` | Reuse a long-running dev server instead of spawning one |

---

## ADRs

Load-bearing decisions live in `docs/decisions/`:

| ADR | Subject |
|---|---|
| ADR-001 | Zustand for client state |
| ADR-002 | TanStack Query for server state |
| ADR-003 | React Router 7 for routing |
| ADR-004 | Tailwind 4 + Radix + CVA for styling |
| ADR-005 | react-hook-form + Zod for forms |
| ADR-006 | Vitest + Testing Library + Playwright test stack |
| ADR-007 | Better Auth + `localStorage["bearer_token"]`, `credentials: "omit"` |
| ADR-008 | No AI attribution in commits / PRs |
| ADR-009 | Asks-first dependency gate — no silent `npm install`s |
| ADR-010 | Skill-vs-repo conflict resolution |
| ADR-011 | Airweave widget integration (postMessage transport, BYOC, theme propagation) |

(SPA ADRs are numbered independently of `api-velocity`'s; the same number can refer to different decisions in each repo — see the `cross-repo-workspace` skill.)

---

## Companion Backend

This SPA targets **[api-velocity](../api-velocity)** — NestJS 11 + Better Auth + PostgreSQL.

### Running both stacks

```bash
# Terminal 1 — backend (port 3000)
cd api-velocity
npm run start:dev

# Terminal 2 — frontend (port 5173)
cd ../spa-velocity
npm run dev
```

### What the SPA expects from the API

- All endpoints accept `Authorization: Bearer <token>` (no cookies).
- CORS origin includes `http://localhost:5173` (api-velocity's `TRUSTED_ORIGINS` default).
- Approval gate: `GET /api/admin/users/me/approval-status` drives the `/pending-approval` and `/account-rejected` routing branches.
- Permission catalog: `GET /api/rbac/permissions` hydrates `PermissionsContext`.

---

## Technology Stack

| Tech | Version | Purpose |
|---|---|---|
| React | 19.x | UI framework |
| TypeScript | 5.x | Language |
| Vite | 7.x | Build & dev server |
| React Router | 7.x | Routing |
| TanStack Query | 5.x | Server cache |
| TanStack Table | 8.x | Data tables |
| Zustand | 5.x | Client store (theme) |
| Better Auth | 1.4.x | Auth client (bearer plugin) |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui + Radix | — | UI primitives |
| CVA + tailwind-merge | — | Variants |
| next-themes | 0.4.x | Dark mode |
| react-hook-form | 7.x | Form state |
| Zod | 4.x | Schema validation |
| @airweave/connect-react | 0.9.x | Airweave OAuth widget |
| @dnd-kit | 6.x | Drag-and-drop |
| Vitest | 4.x | Unit / component tests |
| Playwright | 1.57.x | E2E tests |

---

## License

MIT
