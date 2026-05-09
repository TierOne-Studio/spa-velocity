---
name: repo-conventions
description: Use ALWAYS when implementing, reviewing, or refactoring executable code in this repository (spa-velocity); pair with `tdd-workflow`. ALSO use when discussing spa-velocity's architecture, feature layout, RBAC/auth flow, state model, error handling, styling, or any repo-specific decision — even on non-code turns. Documents conventions specific to this codebase: feature-folder layout, Zustand single-global-store + TanStack Query split, React Router 7 with `<ProtectedRoute>`/`<AdminRoute>`, RHF + Zod forms via the `<Field>` compound, Tailwind 4 + Radix + CVA + `cn()`, better-auth with `localStorage.bearer_token`, Vitest + Testing Library + Playwright (per-module). NOT for generic React questions (use `react-patterns`/`react-state-management`/etc.) or read-only investigations of unrelated codebases.
---

# Repo Conventions — spa-velocity

The grounding skill for *this* codebase. Generic React advice goes in the React-stack skills (`react-patterns`, `react-state-management`, `react-performance`, `react-routing`, `react-forms`, `react-testing`); this skill captures the binding decisions of *spa-velocity*. Cite ADRs (`docs/decisions/`) for the *why*; this skill captures the *what*.

## Top-level layout (`src/`)

```
src/
├── app/         — root entry: main.tsx, RootLayout, AppRoutes; global styles
├── assets/      — fonts, images, SVGs (static)
├── features/    — feature modules (Admin, AdminDashboard, Auth, Chat, Dashboard, Projects)
├── shared/      — cross-feature: components/ui, hooks, store, lib, context, types
├── test/        — Vitest setup (setup.ts, vitest-setup.ts)
├── vendor/      — vendored third-party code (rare; prefer npm)
└── vite-env.d.ts
```

Add new code to a **feature folder** unless it's genuinely shared across 2+ features (then `shared/`). Don't introduce new top-level dirs without an ADR.

## Feature folder shape (consistent across all features)

```
features/<Feature>/
├── components/  — feature-private components (composition of shared UI)
├── hooks/       — feature-private hooks (custom + TanStack Query wrappers)
├── views/       — page/route-level components
├── services/    — API clients, data transformers (non-UI)
├── types/       — feature types (or co-located with the consumer)
├── schemas/     — Zod schemas (Auth has this; add when forms exist)
├── utils/       — feature-private utilities (Admin uses this; add when justified)
└── index.ts     — public surface for the feature (re-exports)
```

**Rule:** consumers in other features import from `@/features/<Feature>` (the `index.ts`), not from internal sub-paths. Keeps the public surface explicit.

## Component conventions

- **Function components only.** Class components forbidden except `<ErrorBoundary>` (where React's lifecycle requires a class).
- **Default export + named export** is acceptable (matches existing pattern, e.g., `Button`); pick one and stick with it for the file. Don't mix conventions in the same file.
- **File-per-component** for shared UI (`button.tsx`, `field.tsx`, `card.tsx` in `src/shared/components/ui/`).
- **Compound primitives.** Forms use `<Field><FieldLabel/><Input/><FieldError/></Field>` (compound pattern). Don't reinvent — wrap if styling differs.
- **Radix is the primitive layer.** All dialogs, dropdowns, popovers, tooltips, tabs, etc. wrap `@radix-ui/*` packages. **Don't roll your own dialog or menu** — Radix handles focus trap + ARIA + keyboard for free.

## Hook conventions

- **Shared hooks** live in `src/shared/hooks/` (`useEffectiveSession`, `useOrgRole`, `useOrgScope`, `useOrgCapabilities`, `useMyMemberships`).
- **Feature-private hooks** live in `src/features/<Feature>/hooks/`.
- **Naming:** `useX` (camelCase). Custom hooks read like sentences (`useChatConversations`, not `useGetChatList`).
- **TanStack Query hooks live alongside other feature hooks** in `hooks/` (e.g., `useChat.ts` exports `useChatConversations`, `useChatMessages`, `useSendChatMessage`).

## State model (4-layer)

Per `react-state-management`, this repo uses:

| Layer | Where | When |
|---|---|---|
| **Local** | `useState`/`useReducer` inside the component | Default. State only this component cares about. |
| **Lifted** | Common ancestor passing props + callbacks | 2+ siblings need the same value. |
| **Zustand global store** | `src/shared/store/store.ts` (`useGlobalStore`) | Truly app-wide client state. **Currently theme-only** — feature stores are added per-feature when justified. Uses `immer` for nested updates. |
| **TanStack Query cache** | Per-feature query/mutation hooks | All server state. Source of truth for fetched data. |

**Read the store via selectors:** `useGlobalStore((s) => s.theme)` — never `useGlobalStore()` (subscribes to all changes).

## TanStack Query conventions

### Query keys

Hierarchical, namespaced per feature:

```ts
// src/features/Chat/hooks/useChat.ts
export const chatKeys = {
  all: ['chat'] as const,
  conversations: (userId: string) => [...chatKeys.all, 'conversations', userId] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
}
```

Pattern: `[<feature>, <resource>, <id?>, <params?>]`. Always namespace by feature so `queryClient.invalidateQueries({ queryKey: chatKeys.all })` invalidates the whole feature without collateral damage.

### Hooks return shape

Wrap `useQuery`/`useMutation` in named hooks (`useChatConversations`), not raw inline calls in components. The hook owns the key, the fetch fn, the staleTime/cacheTime decisions, and any select/transform.

### Mutations

`useMutation` with `onSuccess` invalidating the relevant keys. Surface errors via `toast.error(...)` (`sonner`). No client-side retry loops — use `retry: false` on mutations unless the operation is genuinely idempotent.

## Routing (React Router 7)

- **Defined in:** `src/app/views/AppRoutes.tsx`. One canonical location.
- **Protected pattern:** `<ProtectedRoute>` (auth required) and `<AdminRoute requiredPermission="...">` (RBAC). Never reimplement permission checks inside route components.
- **Loaders:** not used. Data fetching lives in TanStack Query hooks invoked by route components. Adding loaders is a structural decision (ADR + `decision-rules` § 6).
- **Auth routes:** `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/set-new-password`, `/accept-invitation/:invitationId`.
- **Code splitting:** wrap heavy routes in `React.lazy` + `<Suspense>` (per `react-routing`).

## Forms (RHF + Zod)

Per `react-forms`:

- Schemas in `<feature>/schemas/<feature>Schemas.ts`. Zod is the source of truth.
- `useForm` with `zodResolver(schema)`. `mode: 'onSubmit'` default.
- The `<Field>` compound pattern handles `aria-invalid`, `aria-describedby`, label/input association.
- Errors via `<FieldError errors={[errors.fieldName]} />`.
- Submit on `form.handleSubmit(onSubmit)` — don't roll your own preventDefault + validate.

Reference forms: `src/features/Auth/views/LoginPage.tsx`, `SignupPage.tsx`.

## Styling

- **Tailwind 4** with the `@tailwindcss/vite` plugin.
- **Radix primitives** wrapped via `class-variance-authority` (CVA) for variant management. See `src/shared/components/ui/button.tsx` for the pattern (`buttonVariants` + `cn(buttonVariants({ variant, size }), className)`).
- **`cn()` helper** at `src/shared/lib/utils.ts`: `clsx(...)` then `twMerge(...)` so later utility classes override earlier ones safely.
- **Dark mode** via `next-themes`: `<ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">` in `AppRoutes.tsx`. Read theme via `useTheme()` from `next-themes`.
- **Design tokens** are inlined as Tailwind classes (`bg-primary`, `text-destructive`, etc.). No external token registry today.

## Auth (better-auth)

- Client configured in `src/shared/lib/auth-client.ts` via `createAuthClient()` + `organizationClient()` + `adminClient()` plugins.
- **Token storage:** `localStorage.bearer_token`, attached as a Bearer header by better-auth. ADR-backed (see `docs/decisions/`).
- Session/auth context: `src/shared/context/AuthContext` exposes `useAuth()`.
- Effective session helpers: `useEffectiveSession`, `useOrgRole`, `useOrgScope`, `useOrgCapabilities` in `src/shared/hooks/`.
- API base: `VITE_API_URL` (default `http://localhost:3000`).

## API client

- **axios** for non-auth endpoints (most of the app talks to the API via service functions in `features/<Feature>/services/`).
- **better-auth client** for the auth surface (sign-in, sign-up, verify, password reset, invitations, organization, admin operations).
- Auth headers attached automatically by the better-auth client; for direct axios calls, attach via interceptor that reads `localStorage.bearer_token`.

## Error handling

- **`<ErrorBoundary>`** at `src/shared/components/ErrorBoundary.tsx` (class component, resets on `resetKey` change). Wrap routes or feature trees.
- **Toasts via `sonner`:** `<Toaster richColors position="top-right" />` in `AppRoutes.tsx`. `toast.success(...)`, `toast.error(...)`. Don't introduce a parallel toast library.
- **Async errors** surface via TanStack Query's `error` field — render an error state, don't catch + ignore.

## Testing

### Vitest setup

- Setup file: `src/test/setup.ts` mocks `window.matchMedia`, `ResizeObserver`, `IntersectionObserver` (jsdom doesn't provide them).
- Config: `vitest.config.ts` with `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`.
- Coverage: `npm run test:coverage` (v8 provider).

### Testing Library

Per `react-testing`: query priority is `getByRole` → `getByLabelText` → `getByPlaceholderText` → `getByText` → `getByTestId`. `userEvent` over `fireEvent`. Async queries (`findByX`) for state changes.

### Playwright (e2e)

- Tests live in `e2e/<module>/` matching the npm scripts:

  | Module | Folder | Script |
  |---|---|---|
  | Auth | `e2e/auth/` | `npm run test:e2e:auth` |
  | Admin | `e2e/admin/` | `npm run test:e2e:admin` |
  | RBAC | `e2e/rbac/` | `npm run test:e2e:rbac` |
  | Chat | `e2e/chat/` | `npm run test:e2e:chat` |
  | Admin Dashboard | `e2e/admin-dashboard/` | `npm run test:e2e:admin-dashboard` |
  | Dashboard | `e2e/dashboard/` | `npm run test:e2e:dashboard` |
  | Layout / nav / guards | `e2e/shared/` | `npm run test:e2e:shared` |
  | API-only | `e2e/api/` | `npm run test:e2e:api` |

- Single Chromium project, no retries, deterministic.
- `test:e2e:smoke` runs the critical login path; `test:e2e:full` runs everything.
- Stable selectors: role/label/text before CSS. No arbitrary sleeps — wait on UI/network state.

## Env vars

- All client-side env vars are `VITE_*` (Vite convention).
- `VITE_API_URL` — backend base URL.
- **Never put secrets in `VITE_*`** — they're shipped to every browser. See `frontend-security`.

## Build / deploy

- `npm run build` — `tsc -b && vite build`.
- `npm run preview` — serves the build at port 4173 (Playwright e2e uses this).
- No deploy infra in-tree (no `vercel.json`, no `netlify.toml`, no GH-Actions deploy). Production is managed externally; `.env.production` points to the prod API.

## ADR-backed conventions (cite ADRs, don't restate rationale)

| Convention | ADR |
|---|---|
| Zustand for client state, TanStack Query for server state | `ADR-001` |
| TanStack Query as server-state library | `ADR-002` |
| React Router 7 as routing library | `ADR-003` |
| Tailwind 4 + Radix + CVA as styling system | `ADR-004` |
| RHF + Zod for forms | `ADR-005` |
| Vitest + Testing Library + Playwright as test stack | `ADR-006` |
| better-auth + `localStorage.bearer_token` for auth | `ADR-007` |
| No AI-attribution trailers in commits/PRs | `ADR-008` |
| Asks-first dependency gate | `ADR-009` |
| Skill-vs-repo conflict resolution | `ADR-010` |

(ADR numbers are placeholders here; the actual numbers land in Phase 7 when `docs/decisions/` is created. The ADR table will be the citation source for the *why*; this skill carries the *what*.)

## Cross-references

- `react-patterns`, `react-state-management`, `react-routing`, `react-forms`, `react-testing` — the React-flavored stack skills.
- `accessibility`, `frontend-security`, `bundle-size`, `react-performance` — quality-bar skills.
- `tdd-workflow`, `design-review`, `plan-mode` — process skills.
- `decision-rules` § 6 — conflict between this skill and a generic skill.
- `documentation-and-adrs` — ADR format and citation flow.
