# React SPA Starter

A production-ready **React SPA** with **Better Auth**, **RBAC**, **Admin Panel**, and **Organization Management**.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Unified Role Model](#unified-role-model)
- [Admin Panel](#admin-panel)
- [Authentication](#authentication)
- [Unit Testing](#unit-testing)
- [E2E Testing](#e2e-testing)
- [Development](#development)
- [Companion Backend](#companion-backend)

---

## Features

| Category | Features |
|----------|----------|
| **Authentication** | Login, signup, email verification, password reset |
| **Authorization** | Unified 3-role model (Admin, Manager, Member), role-based navigation |
| **Admin Panel** | Users, Sessions, Organizations, Roles & Permissions management |
| **Organizations** | Create orgs, invite members, manage roles, impersonation |
| **UI** | Tailwind CSS, shadcn/ui, responsive sidebar, dark mode |
| **Testing** | 327 Vitest unit tests (≥70% coverage) + 123 Playwright E2E tests |

---

## Quick Start

### Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Backend API** — [nestjs-api-starter](../nestjs-api-starter) running on port 3000

### 1. Start Backend

```bash
cd ../nestjs-api-starter
npm install
npm run start:dev
```

### 2. Start Frontend

```bash
cd spa-api-starter
npm install
npm run dev
```

Open **http://localhost:5173**

### 3. Login

Use the test admin account: `delivered+e2e-test-user@resend.dev` / `password123`

---

## Project Structure

```
src/
├── app/                       # Application layer
│   └── views/
│       ├── AppRoutes.tsx      # Route configuration
│       └── RootLayout.tsx     # Layout with sidebar
│
├── features/                  # Feature modules
│   ├── Admin/                 # Admin panel
│   │   ├── views/
│   │   │   ├── UsersPage.tsx
│   │   │   ├── SessionsPage.tsx
│   │   │   ├── OrganizationsPage.tsx
│   │   │   └── RolesPage.tsx
│   │   ├── services/          # API services
│   │   └── hooks/             # React Query hooks
│   │
│   ├── Auth/                  # Authentication
│   │   └── views/
│   │       ├── LoginPage.tsx
│   │       ├── SignupPage.tsx
│   │       ├── ForgotPasswordPage.tsx
│   │       └── VerifyEmailPage.tsx
│   │
│   └── Dashboard/             # Dashboard
│
├── shared/                    # Shared code
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── AdminRoute.tsx     # Admin route guard
│   │   └── ProtectedRoute.tsx # Auth route guard
│   ├── context/
│   │   └── AuthContext.tsx    # Auth provider
│   ├── hooks/
│   │   ├── useOrgRole.ts      # Organization role hook
│   │   └── useIsImpersonating.ts
│   └── lib/
│       └── auth-client.ts     # Better Auth client
│
└── e2e/                       # Playwright tests
    ├── auth.spec.ts
    ├── admin.spec.ts
    ├── rbac-unified-roles.spec.ts
    └── full-coverage.spec.ts
```

---

## Unified Role Model

The frontend enforces the same **3-role model** as the backend:

| Role | Access | Navigation |
|------|--------|------------|
| **Admin** | Full platform access | Users, Sessions, Organizations, Roles & Permissions |
| **Manager** | Organization-scoped | Dashboard, Invitations (no admin panel) |
| **Member** | Basic read access | Dashboard, Invitations (no admin panel) |

### Role-Based Navigation

The sidebar automatically shows/hides items based on user role:

```tsx
// Admin sees:
- Dashboard
- My Invitations
- Admin
  - Users
  - Sessions
  - Organizations
  - Roles & Permissions

// Manager/Member sees:
- Dashboard
- My Invitations
```

### Route Protection

**AdminRoute** - Only allows `admin` role:
```tsx
<Route path="admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
```

**ProtectedRoute** - Requires authentication:
```tsx
<Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
```

### Checking Roles

```tsx
import { useAuth } from "@shared/context/AuthContext";

function MyComponent() {
  const { user, isAdmin } = useAuth();
  
  if (isAdmin) {
    // Show admin features
  }
  
  // user.role is 'admin' | 'manager' | 'member'
}
```

---

## Admin Panel

### Pages

| Route | Page | Features |
|-------|------|----------|
| `/admin/users` | Users | List, create, edit, ban/unban, change role, impersonate |
| `/admin/sessions` | Sessions | View sessions, revoke single/all |
| `/admin/organizations` | Organizations | Create, edit, delete, manage members, invite |
| `/admin/roles` | Roles & Permissions | View roles, manage permissions |

### Users Page

- Server-side paginated table with search
- Actions: Edit, Ban/Unban, Change Role, Impersonate, Delete
- Create new users with role assignment

### Organizations Page

- List all organizations
- Create/Edit/Delete organizations
- Manage members (add, remove, change role)
- Send invitations
- Cancel pending invitations

### Roles & Permissions Page

- View all roles (Admin, Manager, Member)
- See permissions assigned to each role
- Manage permission assignments
- Create custom roles

---

## Unit Testing

### Stack

- **[Vitest](https://vitest.dev/)** — fast unit test runner (jsdom environment)
- **[React Testing Library](https://testing-library.com/)** — component rendering and interaction
- **[@testing-library/user-event](https://testing-library.com/docs/user-event/intro/)** — realistic user interactions
- **[v8 coverage](https://vitest.dev/guide/coverage)** — statement, branch, function, and line coverage

### Running Tests

```bash
# Run all unit tests (with coverage report)
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Run a specific file
npm test -- --run src/features/Auth/views/__tests__/LoginPage.test.tsx
```

### Coverage Thresholds

All files must meet **≥ 70%** for statements, branches, functions, and lines.

```
Statements : 96%   Branches : 89%   Functions : 92%   Lines : 98%
```

### Test File Conventions

```
src/
├── features/
│   └── Auth/
│       ├── schemas/
│       │   └── authSchemas.ts          # Zod validation schemas
│       └── views/__tests__/
│           └── LoginPage.test.tsx
├── shared/
│   ├── components/__tests__/
│   │   └── OrganizationSwitcher.test.tsx
│   └── components/ui/__tests__/
│       ├── button.test.tsx
│       ├── dialog.test.tsx
│       ├── field.test.tsx
│       └── theme-toggle.test.tsx
└── features/Admin/services/__tests__/
    ├── adminService.users.test.ts
    ├── adminService.impersonation.test.ts
    ├── adminService.organizationService.test.ts
    └── rbacService.crud.test.ts
```

### Form Validation

Forms use **[react-hook-form](https://react-hook-form.com/)** with **[Zod](https://zod.dev/)** schemas via `@hookform/resolvers`:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/features/Auth/schemas/authSchemas";

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(loginSchema),
});
```

---

## Authentication

### Auth Routes

| Route | Description |
|-------|-------------|
| `/login` | Login page |
| `/signup` | Registration |
| `/forgot-password` | Request password reset |
| `/set-new-password` | Reset password with token |
| `/verify-email` | Email verification |

### Using Auth Context

```tsx
import { useAuth } from "@shared/context/AuthContext";

function MyComponent() {
  const { 
    user,            // Current user
    isAuthenticated, // Boolean
    isAdmin,         // Boolean
    isLoading,       // Loading state
    login,           // (email, password) => Promise
    logout,          // () => Promise
  } = useAuth();
}
```

### Better Auth Client

```tsx
import { authClient } from "@shared/lib/auth-client";

// Direct API calls
await authClient.signIn.email({ email, password });
await authClient.signUp.email({ email, password, name });
await authClient.signOut();
```

---

## E2E Testing

### Test Files (123 tests total)

| File | Tests | Coverage |
|------|-------|----------|
| `auth.spec.ts` | 17 | Authentication flows |
| `admin.spec.ts` | 24 | Admin panel navigation |
| `rbac-unified-roles.spec.ts` | 36 | Role-based access control |
| `full-coverage.spec.ts` | 36 | CRUD operations |
| `rbac-impersonation.spec.ts` | 10 | Impersonation UI |

### Running Tests

```bash
# All tests (headless)
npm run test:e2e

# List all discovered tests
npm run test:e2e:list

# Watch tests run (headed)
npm run test:e2e:headed

# Interactive UI
npm run test:e2e:ui

# View HTML report manually (tests no longer auto-open/stick)
npm run test:e2e:report
```

### Run by Feature Section (faster local loop)

```bash
# Auth section
npm run test:e2e:auth

# Admin UI section
npm run test:e2e:admin

# RBAC + impersonation section
npm run test:e2e:rbac

# CRUD-heavy admin flows
npm run test:e2e:full-crud

# API-focused E2E checks
npm run test:e2e:api
```

### Isolated E2E Mode (while you keep dev servers running)

Use isolated ports and database so Playwright does not fight your local dev session:

```bash
# Full isolated suite
npm run test:e2e:isolate

# Isolated auth-only
npm run test:e2e:isolate:auth

# Isolated admin-only
npm run test:e2e:isolate:admin
```

Isolated mode uses:
- API: `http://127.0.0.1:3100`
- Frontend: `http://127.0.0.1:4173`
- DB: `postgresql://mravinale@localhost:5432/nestjs_api_starter_e2e`

You can override these per run with:
- `E2E_API_BASE_URL`
- `E2E_FE_URL`
- `E2E_DATABASE_URL`
- `E2E_TEST_USER_EMAIL`
- `E2E_TEST_USER_PASSWORD`

### Test Coverage

**Role-Based Access:**
- ✅ Admin can access all admin pages
- ✅ Manager cannot access admin pages
- ✅ Member cannot access admin pages
- ✅ Direct URL access is blocked for non-admins

**CRUD Operations:**
- ✅ Create/Edit/Delete users
- ✅ Ban/Unban users
- ✅ Create/Edit/Delete organizations
- ✅ Add/Remove organization members
- ✅ Create/Delete roles
- ✅ Manage permissions

**API Protection:**
- ✅ Unauthenticated requests rejected (401/403)

---

## Development

### Scripts

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # ESLint
npm test              # Run Vitest unit tests with coverage
npm run test:e2e      # Run Playwright E2E tests
```

### Adding Admin Features

1. Create page in `src/features/Admin/views/`
2. Add service in `src/features/Admin/services/`
3. Add hooks in `src/features/Admin/hooks/`
4. Add route in `src/app/views/AppRoutes.tsx` with `AdminRoute`
5. Add navigation item in sidebar

### Adding Protected Routes

```tsx
// In AppRoutes.tsx
<Route
  path="my-feature"
  element={
    <ProtectedRoute>
      <MyFeaturePage />
    </ProtectedRoute>
  }
/>
```

---

## Companion Backend

This SPA works with **[nestjs-api-starter](../nestjs-api-starter)**:

### Running Together

```bash
# Terminal 1: Backend (port 3000)
cd nestjs-api-starter
npm run start:dev

# Terminal 2: Frontend (port 5173)
cd spa-api-starter
npm run dev
```

### API Configuration

Default API URL: `http://localhost:3000`

To customize, create `.env`:
```env
VITE_API_URL=http://localhost:3000

# Airweave OAuth portal URL — used by /admin/airweave when adding source
# connections that authenticate via the Airweave portal (Slack, Notion,
# etc.). The SPA opens this URL in a new tab with `?session_token=<token>`
# appended. Leave unset to disable the OAuth tab in the
# create-source-connection dialog (direct-auth still works).
#
# v1 uses query-string encoding; URL fragment (`#session_token=`) is
# preferred for Referer-leak protection and may be adopted when Airweave
# portal support is confirmed (see the airweave CRUD UI plan, Step 0
# fragment-vs-query decision).
VITE_AIRWEAVE_PORTAL_URL=https://app.airweave.ai/connect
```

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 7.x | Build tool |
| Better Auth | 1.4.x | Auth client |
| React Router | 7.x | Routing |
| TanStack Query | 5.x | Server state |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | - | UI components |
| react-hook-form | 7.x | Form state management |
| Zod | 4.x | Schema validation |
| Vitest | 3.x | Unit testing |
| Playwright | 1.x | E2E testing |

---

## License

MIT

