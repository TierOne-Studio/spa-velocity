---
name: react-performance
description: Use when investigating actual rerender cost, slow lists, oversized effects, code-splitting decisions, or Core Web Vitals issues — and when judging whether a memoization change (`React.memo`, `useMemo`, `useCallback`) is justified. Pairs with `react-render-optimization` (the patterns.dev catalog) for deeper rerender mechanics. NOT for general bundle-size concerns (use `bundle-size`), routing-level code splits (use `react-routing`), or server-state caching (use `react-data-fetching`).
---

# React Performance

Performance work in React is a measurement game, not a memoization game. Premature `useMemo` everywhere is **negative** value — it adds work, costs memory, and obscures the real bottleneck. This skill encodes the discipline.

## When this fires

- A component is measurably slow (Profiler, DevTools, user-reported jank).
- A list has hundreds+ items and feels laggy.
- An effect is firing far more than expected.
- A bundle audit shows a too-large initial chunk.
- A code review proposes adding `useMemo`/`useCallback`/`React.memo`.

## When this does NOT fire

- "Looks fine, but I want to be safe" — that's premature optimization. Measure first.
- Bundle-tree decisions like which package to import (use `bundle-size`).
- Server-state cache settings (use `react-data-fetching`).

## Hard rules

1. **Measure first.** Profiler, `console.time`, `performance.mark`, the DevTools "Components" tab, Lighthouse for Core Web Vitals. Without a number, you can't tell whether your change helped.

2. **Default: NO `useMemo`/`useCallback`/`React.memo`.** Add only when (a) the wrapped value is genuinely expensive to compute or recreate, AND (b) the downstream dep array or memoized component depends on identity stability. Both must be true.

3. **`React.memo` doesn't compound.** Wrapping every leaf doesn't speed things up — referential equality at the leaf is irrelevant if the parent is rerendering and passing fresh props.

4. **Effect dependency arrays are not a place to be sloppy.** A missing dep is a bug. An over-included dep causes excess reruns. Both manifest as "performance" but are correctness issues.

## Patterns

### Virtualize long lists

Lists over ~100 visible items benefit from virtualization. Use `@tanstack/react-virtual` (lightweight, no extra dep tree) — render only the slice in view. Existing `react-table` integrations can wrap virtualization too.

### Code-split heavy routes

Use `React.lazy` + `<Suspense>` for routes that pull in large dependency trees (charts, editors, AI playgrounds). Pair with the route-level boundary so the rest of the app stays fast. See `react-routing` § Code splitting.

### Lazy-load on interaction or visibility

Heavy widgets (charts, video, third-party embeds) that aren't in the initial viewport can wait. Strategies: import on first interaction, import on `IntersectionObserver` visibility, prefetch during idle. (Patterns previously broken into separate skills are now folded here.)

### Stable identity for memoized children

If you're going to `React.memo` a list item, the item props must be referentially stable. That means stable callbacks (`useCallback`), stable data (don't reconstruct objects in the parent's render), and stable list keys (no index keys). Skipping any of these voids `React.memo`.

### Resource hints (preload, prefetch, preconnect)

For known-next-route assets, hint to the browser. Vite supports preload/prefetch via plugin or manual `<link>` tags. Use sparingly; over-prefetching hurts more than it helps.

### Image optimization

Use modern formats (WebP / AVIF). Set explicit `width`/`height` to avoid layout shift. Use `loading="lazy"` for below-the-fold. Vite handles asset hashing; cache-bust correctly.

### Avoid wide context for frequently-changing values

A theme context updated once per session is fine. A mouse-position context rerenders the whole subtree on every move. Move it to a ref + observer, or to a Zustand selector subscription.

## Anti-patterns

- **Memoizing values that aren't expensive.** `useMemo(() => x + 1, [x])` is slower than recomputing.
- **`useCallback` without a downstream consumer that needs identity stability.** Wasted work.
- **`React.memo` on components whose props change every render anyway.** Equality check runs, fails, component rerenders. Net loss.
- **Unmeasured optimization.** "I added `useMemo` and it feels faster." No. Profile.
- **Wide context.** Triggers cascading rerenders across the tree.
- **Hidden side effects in renders.** A `console.log` at module-top is fine; an `analytics.track()` at module-top runs on every import. Be intentional.
- **`Promise.race` for timeout** — see `async-error-handling`.

## Cross-references

- `react-render-optimization` — patterns.dev catalog; deeper rerender mechanics.
- `react-state-management` — derived-state and context discipline.
- `bundle-size` — code-split, tree-shake, third-party audit.
- `js-performance-patterns` — JS-runtime-level loop and data-structure patterns.
- `react-routing` — route-level code splitting.
