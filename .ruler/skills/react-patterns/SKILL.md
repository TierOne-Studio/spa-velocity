---
name: react-patterns
description: Use ALWAYS when implementing or reviewing React components, hooks, or rendering logic in this SPA. Covers component shape (function components only, default vs named export, controlled vs uncontrolled, lifting state), hook discipline (rules-of-hooks, dependency arrays, cleanup, custom-hook extraction), refs vs state, list keys, and the boundaries between presentation, state, and data layers. NOT for state-placement decisions (use `react-state-management`), data-fetching (use `react-data-fetching`), routing (use `react-routing`), forms (use `react-forms`), or rendering performance (use `react-performance` / `react-render-optimization`).
---

# React Patterns

The grounding skill for React component and hook design in this SPA. Forced-fire on every change touching `.tsx`/component logic. Pair with `repo-conventions` for repo-specific layout and `react-composition-2026` for modern composition idioms.

## When this fires

- Writing or modifying a `.tsx` component or custom hook.
- Reviewing a PR that adds rendering logic.
- Deciding whether a piece of behavior is a hook, a component, or a plain function.
- Refactoring a component that's grown unwieldy.

## When this does NOT fire

- Pure utility / non-React module work (use `module-pattern`).
- State-placement decisions (use `react-state-management`).
- Routing-shape decisions (use `react-routing`).

## Component shape (hard rules)

1. **Functional components only.** No class components except `<ErrorBoundary>` (where the lifecycle is required by React itself). Class-based components must NEVER be added in new code.

2. **Default to named exports for shared UI; default-export components are fine for route-level views.** Match the surrounding file's pattern; don't mix.

3. **One component per file** unless components are tightly coupled and only used together (e.g., `<TabsRoot>` + `<TabsList>` + `<TabsPanel>` from the compound pattern).

4. **Props are typed** with `interface` (preferred for public component APIs) or `type` (preferred for composed/conditional types). No `any`. No `object` as a prop type.

5. **Controlled vs uncontrolled — pick deliberately.** A component is controlled if its value comes from props and changes are notified via `onChange`. Uncontrolled if it owns its own state. Mixing both (passing `value` AND letting the component mutate internal state) is a bug source.

6. **No `forwardRef` unless a ref is genuinely needed** (focus management, animation, third-party DOM library). Passing refs as ordinary props (e.g., `inputRef`) is the modern alternative for non-DOM refs.

## Hook discipline (hard rules)

1. **Rules of hooks are absolute.** Top-level only, no conditional calls, no calls inside loops, no calls after early returns. ESLint `react-hooks/rules-of-hooks` enforces this — don't disable it.

2. **Dependency arrays are exhaustive.** ESLint `react-hooks/exhaustive-deps` catches missing deps. If the rule is wrong (rare), document inline why; never just disable.

3. **Custom hooks for reusable behavior, not for moving code around.** Extract a `use*` hook ONLY when (a) two components share the behavior, OR (b) the hook has a clear domain identity (`useEffectiveSession`, `useOrgScope`). Single-use hooks that wrap one effect are usually noise — inline them.

4. **Hooks return data + identity-stable functions.** When a hook returns a callback, ensure it's wrapped in `useCallback` only if a downstream dep array depends on it. Don't `useCallback` everything by default — `react-performance` covers when memoization is justified.

5. **Cleanup in `useEffect` is not optional** for subscriptions, timers, listeners, AbortControllers. The cleanup runs on unmount AND before each rerun.

6. **Effects should be the last resort, not the first.** If a value can be derived from props/state at render, do that. If it can be computed in a render-time helper, do that. Effects are for synchronizing with external systems (DOM APIs, third-party libs, server state if you're not using TanStack Query).

## Patterns to use

- **Compound components** for related UI that shares implicit state (tabs, accordions, dropdown menu). See `compound-pattern`.
- **Provider** for cross-tree concerns scoped to a feature (theme, auth context). See `provider-pattern`.
- **Presentational/container split** when one component has both fetching and rendering responsibilities and tests are awkward. See `presentational-container-pattern`.
- **Custom hook + presentational component** is the modern equivalent of the container/presentational split — keep the data hook in `hooks/` and the visual component in `components/`. See `repo-conventions` § Feature folder structure.

## Anti-patterns

- **Effects that derive state from props.** `useEffect(() => setX(props.y), [props.y])` is almost always a `useMemo` or just `props.y` itself.
- **`useEffect` for events.** A button click is an event handler, not an effect.
- **Lifting state too eagerly.** Start local. Lift only when a second consumer appears.
- **Pulling a wide context into a leaf.** Triggers rerenders across the whole subtree on context value change. Pass props or pull a narrower selector.
- **`forwardRef` chains for everything.** Each layer of `forwardRef` adds boilerplate; only unwrap rendering down to the DOM node when you actually need the ref.
- **Index as `key` for dynamic lists.** Breaks reconciliation when items reorder. Use a stable identifier.
- **`useCallback`/`useMemo` on every value.** Not free; only justify when measured rerender cost is real (`react-performance`).
- **Class components for new code.** Convert to function components.

## Cross-references

- `react-state-management` — where state lives (local, context, store, server-state).
- `react-data-fetching` — TanStack Query patterns.
- `react-routing` — route components, guards, loaders.
- `react-forms` — RHF + Zod.
- `react-performance` — when memoization is justified.
- `accessibility` — semantic markup, focus, keyboard.
- `repo-conventions` § Component conventions / Hook conventions — repo-specific shape rules.
