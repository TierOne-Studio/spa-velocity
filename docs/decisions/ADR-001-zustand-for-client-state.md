# ADR-001: Zustand for app-wide client state

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

The SPA needs a place for genuinely app-wide client state — values that cross feature boundaries, are read by multiple unrelated routes, and outlive any single component (e.g., theme, current organization, sidebar collapse, feature flags). React's built-in primitives (`useState`, `useReducer`, `Context`) cover everything below this tier; the question is which library fills the cross-tree, app-wide tier.

Constraints:
- React 19, TypeScript 5.8 strict.
- Bundle size matters (every kB ships to every browser).
- Selector-based reads must avoid cascading rerenders for high-frequency values.
- Server state has its own home (TanStack Query — see ADR-002); the client store must NOT mirror server data.

Visible in: [`src/shared/store/store.ts`](../../src/shared/store/store.ts).

## Decision

We use **[Zustand](https://github.com/pmndrs/zustand) 5** with the **[`immer`](https://immerjs.github.io/immer/) middleware** for the single global client store. Reads use selectors only (`useGlobalStore((s) => s.theme)`, never `useGlobalStore()`). Server-fetched data NEVER lives in the store; it lives in the TanStack Query cache (per ADR-002). Token storage is delegated to better-auth (per ADR-007), not the store.

Currently the store is theme-only. Feature-scoped slices may be added when justified; an additional store may be introduced when a feature's state is large and isolated, but the default is one global store with feature-scoped slices.

## Alternatives considered

- **Redux Toolkit** — well-supported, but the boilerplate (slices, dispatch, action types) is heavier than this app needs. Selector ergonomics are similar. Rejected for ergonomics + bundle.
- **Jotai** — atom-based, fine-grained reactivity. Conceptually clean for derived state, but the team's existing Zustand familiarity wins. Worth revisiting if the global state's reactivity needs grow.
- **Recoil** — Facebook-stewardship is unclear (last release activity slowing). Rejected for maintenance risk.
- **Context-only** — works for low-frequency app-wide values but causes whole-tree rerender cascades for high-frequency ones (e.g., a value that updates on every tab switch). Rejected as the *primary* mechanism; still used for genuinely cross-tree-scoped concerns like theme provider, auth provider.

## Consequences

- **Positive:** small bundle, selector-based reads, `immer` makes nested updates ergonomic, no boilerplate, easy to test.
- **Negative:** fewer DevTools hooks than Redux, less framework-imposed structure (team must self-discipline on slice boundaries).
- **Follow-ups:** if the store grows past a single domain, evaluate splitting to feature-scoped stores OR introducing a second store. Don't preemptively split.

## References

- [`src/shared/store/store.ts`](../../src/shared/store/store.ts) — `useGlobalStore` definition.
- [`react-state-management`](../../.ruler/skills/react-state-management/SKILL.md) — the 4-layer model that places Zustand at layer 4a.
- [`repo-conventions`](../../.ruler/skills/repo-conventions/SKILL.md) § State model.
