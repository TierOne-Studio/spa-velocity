---
name: react-state-management
description: Use when deciding WHERE state lives — component-local, lifted, context, Zustand store, or TanStack Query cache — and when reviewing a state-shape decision. Covers the four-layer model (local / context / client store / server cache), derived-state pitfalls, and migration heuristics (when to promote local → context, context → store). NOT for component-shape decisions (use `react-patterns`), hook design (use `hooks-pattern`), or specific data-fetching mechanics (use `react-data-fetching`).
---

# React State Management

In this SPA the state lives in four layers. Picking the right one is the single highest-leverage decision in feature design — getting it wrong creates the rerender, sync, and "single-source-of-truth violation" bugs that dominate component code.

## The four layers

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Component-local (useState / useReducer)                  │
│    — Default. State that exactly one component cares about. │
├─────────────────────────────────────────────────────────────┤
│ 2. Lifted to common ancestor (props down, callbacks up)     │
│    — When 2+ siblings need to share. STILL local.           │
├─────────────────────────────────────────────────────────────┤
│ 3. Context (React.createContext + Provider)                 │
│    — Cross-tree, scoped to a subtree. Avoid for             │
│      frequently-changing values (rerenders cascade).        │
├─────────────────────────────────────────────────────────────┤
│ 4a. Zustand store (truly app-wide client state)             │
│     — Theme, current org, sidebar collapsed, feature flags. │
│     — Selector-based reads avoid wide rerender cascades.    │
├─────────────────────────────────────────────────────────────┤
│ 4b. TanStack Query cache (server state)                     │
│     — Anything that came from a server. Cache, revalidate,  │
│       invalidate. NEVER mirror server state into Zustand.   │
└─────────────────────────────────────────────────────────────┘
```

**Decision flow:** start at 1. Promote to 2 only when a second consumer appears. Promote to 3 only when prop-drilling is genuinely painful (4+ layers, or props that have nothing to do with the intermediate components). Promote to 4 only when the value crosses unrelated routes/features.

## Hard rules

1. **Server state lives in TanStack Query.** Anything fetched goes in the query cache. Don't `useEffect(() => fetch(...))` and store in `useState`. Don't mirror query data into a Zustand slice. The cache is the source of truth.

2. **Never duplicate the same fact in two layers.** If `currentOrg` lives in Zustand AND the query cache, one will go stale. Pick the layer that owns it; derive everything else.

3. **Derive, don't sync.** If `filteredItems` can be computed from `items` + `filter`, compute it at render time. Don't store `filteredItems` and use `useEffect` to keep it in sync — that's a bug factory.

4. **Context is for stable identity, not for high-frequency values.** A theme value changing once per session is fine in context. A mouse position is not — every consumer rerenders on every mousemove. Use a ref or a Zustand store with a selector instead.

5. **Don't lift state preemptively.** A `useState` inside one component, used only there, is correct. Lifting "in case we need it later" is YAGNI.

6. **Selector-based reads only from Zustand.** `useGlobalStore((s) => s.theme)` — not `const store = useGlobalStore()`. A non-selector read subscribes the component to every state change.

## Per-layer patterns

### Local (`useState`/`useReducer`)
- Use `useState` for primitives and small objects.
- Use `useReducer` when state transitions are governed by 3+ actions OR transitions encode invariants (e.g., a wizard form).

### Lifted
- Pass `value` and `onChange` (controlled child) — don't expose internal state.
- Keep the lifted state at the closest common ancestor; don't lift it to the root.

### Context
- Split contexts by *change rate*: a "theme + locale + auth user" mega-context is wrong; three contexts are right.
- Memoize the provider value: `const value = useMemo(() => ({...}), [deps])`.
- Default value of `createContext` should be a sentinel that throws on access outside the provider, not a fake object.

### Zustand store
- One store per feature domain when the domain has multiple slices, OR a single global store with feature-scoped slices when domains are small. This repo currently uses a single global store at `src/shared/store/store.ts`; introduce a feature store only when justified.
- Use `immer` for nested mutations (already wired into the store).
- Persist sparingly. Persisting auth tokens to localStorage is a security decision (see `frontend-security`).

### TanStack Query cache
- Follow the project's query-key convention (see `react-data-fetching` and `repo-conventions`).
- Invalidate on mutations; don't read from the cache and write to a Zustand slice.

## Anti-patterns

- **Mirroring server state in Zustand.** `useEffect(() => store.setProjects(query.data))` — wrong. Read `query.data` directly.
- **Storing derived values.** `useState(filteredItems)` — derive at render.
- **Putting JWT tokens in Zustand persist middleware.** Token storage is an auth/security decision (see `frontend-security`).
- **Wide context for frequently-changing values.** Causes whole-tree rerenders.
- **`useReducer` for two-action state machines.** `useState` is fine.
- **Promoting state to context "in case another component needs it."** Wait for the second consumer.

## Cross-references

- `react-data-fetching` — TanStack Query patterns + query keys.
- `react-patterns` — component shape; lifted state via props/callbacks.
- `provider-pattern` — context provider mechanics.
- `frontend-security` — token storage decisions.
- `repo-conventions` — current Zustand layout, current TanStack Query key conventions.
