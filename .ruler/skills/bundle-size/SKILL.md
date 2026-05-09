---
name: bundle-size
description: Use when adding a new dependency, when the build output grows noticeably, when investigating bundle composition (Rollup visualizer / Vite analyze), or when judging tree-shaking, side-effect declarations, and import-style choices. Pair with `react-performance` for runtime work and `vite` for Vite-specific config. NOT for general performance investigations or pure runtime hot paths.
---

# Bundle Size

Bundle bloat is a silent UX killer — every kilobyte costs a percentage of low-bandwidth users. The default React/Vite stack is small, but each new dependency, each barrel-import, and each accidental polyfill compounds.

## When this fires

- Adding a new `dependencies` or `devDependencies` entry.
- A code review where the diff imports a new library.
- A build output noticeably larger than baseline.
- Investigating "why is my chunk so big?"
- Considering a polyfill, transform, or shim.

## When this does NOT fire

- Pure runtime perf (use `react-performance`).
- Vite-config rejiggering for dev-server speed (use `vite`).
- Compression / server config (Vite handles via the build; server-side gzip/brotli is infrastructure).

## Hard rules

1. **Asks-first dependency gate.** Per CLAUDE.md, adding a new dependency requires explicit user approval. State the reason, the bundle cost, the alternative, and pause.

2. **Tree-shake by importing narrowly.** `import { x } from 'lib/specific-module'` over `import { x } from 'lib'`. Most modern libs are ESM with proper `sideEffects: false`, but check `package.json` of the library to confirm.

3. **Lazy-load route-heavy chunks.** A chart library, a markdown editor, an AI playground — none of these belong in the initial bundle if they're behind a route. See `react-routing` § Code splitting.

4. **No polyfills for browsers we don't support.** This SPA targets evergreen browsers; importing `core-js` for IE11 fixes is a regression.

5. **Don't import the whole library to get a date format.** `import format from 'date-fns/format'` (~3KB) over `import { format } from 'date-fns'` (whole tree). Or use `Intl.DateTimeFormat` directly — zero bundle cost.

## Pattern catalog

### Static imports for the always-needed

ES static imports are the fastest path and benefit fully from tree-shaking. Default everything to static unless you have a specific lazy-load reason.

### Dynamic imports for route/feature splits

```ts
const ChartsPage = lazy(() => import('@/features/Charts/views/ChartsPage'))
```

The dynamic import becomes its own chunk; Vite outputs it under `dist/assets/<hash>.js`.

### Side-effect-free package.json

If you author a shared package or local module, add `"sideEffects": false` (or list specific files) so importers tree-shake correctly.

### Avoid heavy default-imports of utility libs

```ts
// ❌ Imports the whole lodash bundle (~70KB)
import _ from 'lodash'

// ✅ Per-method import
import debounce from 'lodash/debounce'

// ✅✅ Or just use native:
const debounced = useMemo(() => debounceFn, [])  // local debounce or AbortSignal-based
```

### Audit with the Vite bundle visualizer

Add `rollup-plugin-visualizer` (devDep) to surface chunk composition. Run `npm run build` then open the report. Red flags: a single route chunk > 200KB, a vendor chunk dominated by one library you barely use, a polyfill bundle for unsupported browsers.

### Server-side compression

Production deploy should serve `.js` and `.css` with Brotli (or Gzip fallback). Vite's build emits compressed assets if `build.rollupOptions.output` is configured with the appropriate plugin, or the host (Vercel, Netlify, S3+CloudFront) does it on serve. This is infrastructure, not application code.

## Anti-patterns

- **Adding moment.js.** It's huge (~250KB) and largely deprecated. Use `date-fns` (per-method) or native `Intl`.
- **`import * as X from 'big-lib'`.** Defeats tree-shaking; pulls everything.
- **Including a polyfill "just in case."** Decision based on actual browser-support targets in `browserslist`/`vite.config.ts`, not vibes.
- **Bundling test fixtures into the production build.** Vite excludes test files by default; don't break the convention.
- **Shipping source maps to production without intent.** Useful for error tracking; costly if not.
- **Re-importing a feature's whole barrel for one symbol.** `import { Project } from '@/features/Projects'` may pull the entire feature tree if the index re-exports broadly.
- **Adding a UI library when 3 components from Radix would do.** This repo standardizes on Radix primitives + Tailwind; a competing UI library duplicates 100KB+.

## Audit checklist for a new dependency

```
[ ] What's the unminified + minified + gzipped size? (bundlephobia.com / packagephobia.com)
[ ] Does it have peer-deps that we'd also pull in?
[ ] Is it ESM with sideEffects: false?
[ ] Is there a smaller alternative (or none-needed via native API)?
[ ] License compatible? (MIT/Apache/BSD = fine; GPL/AGPL = ask)
[ ] Maintained? (last commit, open issues, weekly downloads)
[ ] Security advisories? (npm audit, snyk)
[ ] Bundle visualizer post-add: does it land in vendor or feature chunk? Reasonable?
```

## Cross-references

- `react-performance` — runtime cost (rerenders, list virtualization).
- `vite` — Vite-config knobs for chunk strategy.
- `react-routing` — code splitting per route.
- `frontend-security` — dep audit, supply-chain.
- ADR — asks-first dep gate (port from api-velocity ADR-006 → spa-velocity equivalent).
