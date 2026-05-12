---
name: react-routing
description: Use when adding, modifying, or reviewing routes in this SPA — including route definitions, nested layouts, route guards (auth + RBAC), redirected/expired-session flows, code splitting per route, search-param state, and route-level error boundaries. NOT for general component layout (use `react-patterns`), data-fetching inside a route (use `react-data-fetching`), or auth-token storage (use `frontend-security`).
---

# React Routing (React Router 7)

Routes are security boundaries first, navigation second. Every route the user can land on is a permission check, an auth check, or a public page — none of those happen by accident. This skill encodes the discipline.

## When this fires

- Adding a route to `AppRoutes.tsx`.
- Adding/modifying a route guard.
- Implementing redirect-on-expired-session.
- Code-splitting a heavy route.
- Reading search-param state.

## When this does NOT fire

- Layout/styling decisions inside a route component (use `react-patterns`).
- Data-fetching mechanics (use `react-data-fetching`).

## Hard rules

1. **Every route is either explicitly public or guarded.** No silent assumption that "the parent guard catches this." If the route is public, comment so.

2. **Guards are security boundaries.** Treat them as you would server-side authorization. Changes to a guard MUST trigger `security-reviewer`.

3. **Permission logic lives in the guard, not duplicated in every route.** If you find yourself adding `if (!user.canX) navigate('/forbidden')` inside three route components, that logic belongs in a guard.

4. **Don't expose internal IDs in URLs without considering the leak.** If a URL parameter discloses an org-internal numeric ID, that's an information leak. Use slugs/uuids per `repo-conventions`.

5. **Route components are thin.** They wire data hooks to presentation. Heavy logic belongs in feature hooks/services.

## Patterns

### Protected route + admin route

Wrap routes that require authentication with a `<ProtectedRoute>` that:
- Reads auth state from `useAuth()`.
- Redirects unauthenticated users to `/login` with `?from=<intended>` for return-after-login.
- Redirects banned/pending-approval users to the appropriate state page.

Wrap routes that require RBAC permissions with `<AdminRoute requiredPermission="...">`:
- Composes on top of `<ProtectedRoute>`.
- Reads effective permissions from the auth/org-scope hooks.
- Redirects denied users to a "no access" view (NOT silently to the home page — surfacing the denial is correct UX).

### Code splitting per heavy route

```tsx
const ChartsPage = lazy(() => import('@/features/Charts/views/ChartsPage'))
const AdminConsole = lazy(() => import('@/features/Admin/views/AdminConsole'))

<Routes>
  <Route path="/charts" element={
    <Suspense fallback={<RouteSpinner />}>
      <ChartsPage />
    </Suspense>
  } />
</Routes>
```

Wrap each lazy route with its own `<Suspense>` so the rest of the app stays interactive while one route loads.

### Route-level error boundary

Wrap routes (or route trees) in an `<ErrorBoundary>` so a crash in one feature doesn't blank the whole app. The boundary should reset on route change (`resetKey`) so navigating away clears the error.

### Search-param state

For state that should round-trip via URL (filters, sort, pagination), use `useSearchParams` from React Router 7. Keep the URL the source of truth — don't mirror to component state.

```tsx
const [params, setParams] = useSearchParams()
const filter = params.get('filter') ?? 'all'
```

### Loaders are optional

React Router 7 supports loader/action APIs. This repo currently fetches via TanStack Query hooks inside route components, not via loaders. Don't introduce loaders piecemeal — that's a structural change requiring an ADR (see `decision-rules` § 6 + `documentation-and-adrs`). If a route benefits from preloading (e.g., a slow chart), use TanStack Query's `queryClient.prefetchQuery` from a `useEffect` or from a navigation handler.

### Expired session

When the auth client signals expired/invalid token, the guard should:
1. Clear the local auth state.
2. Redirect to `/login`.
3. Preserve `?from=<intended>` so the user lands back where they were.
4. Surface a toast indicating "session expired" — silent redirect surprises users.

## Anti-patterns

- **Permission checks inside route components.** Move to a guard.
- **Silent redirects on permission denial.** A "no access" page is honest UX.
- **One mega-`<Suspense>` at the root.** Loses per-route isolation; one slow page blocks the whole app.
- **`useEffect(() => navigate(...))`.** Either guard it (don't let the route render) or use the loader/redirect API. Effects are not the right tool for navigation.
- **Storing route-shaped state in Zustand.** URL is the canonical source for filter/sort/pagination state.
- **Coupling routes to components by import order rather than route declaration.** Routes should be discoverable by reading `AppRoutes.tsx`.

## Cross-references

- `react-patterns` — component shape inside the route.
- `react-data-fetching` — how the route gets its data.
- `frontend-security` — auth-token handling, redirect flows.
- `accessibility` — focus management on route change (move focus to main heading).
- `repo-conventions` § Routing — current `<ProtectedRoute>` / `<AdminRoute>` shape.
