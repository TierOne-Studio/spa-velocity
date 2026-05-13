# ADR-003: React Router 7 for routing

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

The SPA needs declarative client-side routing with nested layouts, route guards, code-splitting per route, search-param state, and optional loaders/actions. The repo is a pure SPA (Vite + React 19) — no SSR meta-framework.

Constraints:
- Auth-protected routes require guards composing on top of the auth client.
- Permission-checked routes require RBAC composition.
- The user must land back where they intended after sign-in (`?from=...`).
- Heavy routes (charts, admin console, AI playgrounds) must lazy-load.

Visible in: [`src/app/views/AppRoutes.tsx`](../../src/app/views/AppRoutes.tsx) — canonical route declaration.

## Decision

We use **[React Router 7](https://reactrouter.com/) (`react-router-dom`)** as the routing library, in declarative-routes mode (no loaders/actions in current code). Auth is gated by `<ProtectedRoute>`; permission is gated by `<AdminRoute requiredPermission="...">`. Routes are declared in a single canonical file: `src/app/views/AppRoutes.tsx`. Heavy routes wrap their component in `React.lazy` + per-route `<Suspense>`.

Adopting React Router's loader/action API is a structural decision (would require introducing `createBrowserRouter`/`<RouterProvider>` and migrating route data fetching) and requires a separate ADR before adoption.

## Alternatives considered

- **TanStack Router** — type-safe routes, built-in search-param schema, file-based routing optional. Newer; ecosystem still maturing. Rejected for now; revisit if route-typing pain becomes a recurring issue.
- **Wouter** — minimal, small. Rejected because we need nested routes, not just pattern matching.
- **Next.js / Remix** — meta-framework, server-rendered, file-based routing. Out of scope: this project is a Vite SPA, not a meta-framework app.

## Consequences

- **Positive:** declarative, family-resemblance for any React engineer, mature, supports nested layouts, simple `<Link>`/`<Navigate>`/`useNavigate` API.
- **Negative:** route definitions are stringly-typed (no compile-time guarantee that a route exists); loader/action API still untapped.
- **Follow-ups:** if the routes/guards proliferate, evaluate moving guard composition into a route-config builder. If type-safe params become a frequent footgun, evaluate TanStack Router migration as a future ADR.

## References

- [`src/app/views/AppRoutes.tsx`](../../src/app/views/AppRoutes.tsx).
- [`react-routing`](../../.ruler/skills/react-routing/SKILL.md) — guard pattern, code splitting, expired-session flow.
- [`repo-conventions`](../../.ruler/skills/repo-conventions/SKILL.md) § Routing.
