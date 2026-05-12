# ADR-004: Tailwind 4 + Radix primitives + CVA for styling

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

The SPA needs a styling system that scales across features, supports dark mode, ships small CSS, plays well with TypeScript, and provides accessible primitives out of the box (focus management, ARIA, keyboard handling). Hand-rolling these is error-prone and a major source of a11y regressions.

Constraints:
- Bundle size matters; CSS-in-JS runtime cost is a concern.
- Dark mode toggleable per user.
- Tailwind classes need conditional composition without runtime cost.
- Components must compose with existing Radix headless primitives.

Visible in: [`src/shared/components/ui/`](../../src/shared/components/ui/), [`src/shared/lib/utils.ts`](../../src/shared/lib/utils.ts).

## Decision

We use **[Tailwind CSS 4](https://tailwindcss.com/)** (`@tailwindcss/vite` plugin) for utility-first styling, **[Radix Primitives](https://www.radix-ui.com/primitives)** for accessible component primitives (Dialog, DropdownMenu, Tabs, Popover, Tooltip, etc.), **[`class-variance-authority` (CVA)](https://cva.style/)** for variant management on shared UI components, **[`tailwind-merge`](https://github.com/dcastil/tailwind-merge)** + **[`clsx`](https://github.com/lukeed/clsx)** combined as a `cn()` helper for conditional class composition, and **[`next-themes`](https://github.com/pacocoursey/next-themes)** for dark-mode handling.

The `cn()` helper at [`src/shared/lib/utils.ts`](../../src/shared/lib/utils.ts) is the only allowed way to compose Tailwind classes when conditional logic is involved. Wrapping Radix primitives lives in [`src/shared/components/ui/`](../../src/shared/components/ui/). Don't roll a competing UI library or introduce a parallel CSS-in-JS solution.

## Alternatives considered

- **CSS Modules** — no runtime cost, scoped by default, but no design-token system, no variant API, more boilerplate. Rejected because Tailwind + CVA delivers the same scoping with less ceremony.
- **styled-components / Emotion** — runtime cost, larger bundle, less ergonomic for variant matrices. Rejected for bundle size.
- **vanilla-extract** — zero-runtime CSS-in-JS with type-safe tokens. Compelling, but ecosystem smaller; the team's Tailwind familiarity wins.
- **Headless UI (Tailwind Labs)** — alternative to Radix. Rejected because Radix has wider primitive coverage and stronger a11y tooling.
- **Material UI / Mantine** — opinionated component libraries with their own design system. Rejected because we want utility-first composability and don't want to fight the design system.

## Consequences

- **Positive:** small CSS bundle (Tailwind 4 native engine), accessible primitives for free, CVA gives type-safe variants, dark mode handled by `next-themes`, no runtime CSS-in-JS cost.
- **Negative:** utility-first reads cluttered to those new to Tailwind; variant matrices in CVA can grow.
- **Follow-ups:** if a design-token registry becomes useful (e.g., for theming beyond light/dark), evaluate adopting CSS variables or a token library. Currently tokens are inlined as Tailwind classes (`bg-primary`, `text-destructive`, etc.).

## References

- [`src/shared/lib/utils.ts`](../../src/shared/lib/utils.ts) — `cn()` helper.
- [`src/shared/components/ui/`](../../src/shared/components/ui/) — Radix wrappers + CVA variants.
- [`tailwind-v4-shadcn`](../../.ruler/skills/tailwind-v4-shadcn/SKILL.md) — Tailwind 4 + shadcn integration.
- [`shadcn`](../../.ruler/skills/shadcn/SKILL.md) — shadcn primitive patterns.
- [`accessibility`](../../.ruler/skills/accessibility/SKILL.md) — Radix delivers a11y by default.
