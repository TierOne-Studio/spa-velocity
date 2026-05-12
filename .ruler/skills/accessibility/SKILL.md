---
name: accessibility
description: Use ALWAYS when changing UI markup, interactive elements, dialogs, menus, forms, or anything keyboard-reachable. Covers semantic HTML, ARIA only when needed, focus management on route change and dialog open/close, keyboard navigation, color contrast, screen-reader-only text, and axe checks. NOT for tests of non-UI logic, pure data layers, or build-tool config. Force-fire on any UI diff per CLAUDE.md P3.4.
---

# Accessibility

A11y regressions are the easiest defects to ship — they don't fail unit tests, they don't fail e2e (usually), and self-review almost never catches them. This skill is force-fired on every UI change so the discipline runs even when the prompt didn't mention a11y.

## When this fires

- Any change touching `.tsx` markup or interactive elements.
- Adding a dialog, menu, popover, drawer, sheet, command palette.
- Adding a form (pair with `react-forms`).
- Adding a keyboard shortcut.
- Reviewing a custom component built outside the Radix primitives in `src/shared/components/ui/`.

## Hard rules

1. **Semantic HTML first, ARIA second.** A `<button>` is automatically focusable, clickable, keyboard-activated, and announced as a button. A `<div role="button" tabIndex={0} onClick={...} onKeyDown={...}>` is a defective rebuild of that. ARIA exists for what semantic HTML can't express, not as a paint-over.

2. **Every interactive element is reachable by keyboard.** Tab to focus, Enter/Space to activate, Esc to dismiss (where applicable), Arrow keys for menu/list/grid navigation.

3. **Focus management is mandatory** for:
   - **Dialog open** → first focusable element inside the dialog.
   - **Dialog close** → element that opened it (or a sensible default).
   - **Route change** → main heading or the route-level container.
   - **Form submit error** → first invalid field (RHF default; don't disable).

4. **Every input has a label.** `<FieldLabel htmlFor>` (associating via `htmlFor`/`id`), or wrapping the input inside the label, or `aria-label` (last resort).

5. **No text in images-only.** Icon-only buttons need `aria-label="Save"` or visually-hidden text. Decorative images need `alt=""` to be skipped by screen readers.

6. **Color is not the only signal.** A red border + an error message text. A check icon + a "Saved" text. A focus ring + the focused state.

7. **Contrast.** Text against background must meet WCAG AA (4.5:1 for body, 3:1 for large/UI). Tailwind tokens in this repo have been picked to comply — don't override into low-contrast combinations.

## Patterns to use

### Use Radix primitives

`@radix-ui/react-dialog`, `<DropdownMenu>`, `<Tabs>`, `<Tooltip>`, `<Select>`, `<AlertDialog>` etc. ship with correct keyboard, focus trap, ARIA, and screen-reader announcement out of the box. Wrapping them in our own `src/shared/components/ui/` adds styling but inherits the a11y. **Don't roll your own dialog or menu.**

### Visually-hidden text for icon-only controls

```tsx
<Button>
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Delete project</span>
</Button>
```

### Live regions for async updates

For toasts, error banners, or status messages that appear without focus moving, use `role="status"` (polite) or `role="alert"` (assertive). Sonner already does this correctly.

### Skip-to-main-content

A link at the top of the layout that's focusable but visually hidden (until focused) lets keyboard users skip the nav.

### Heading hierarchy

One `<h1>` per route. Headings nest sequentially (no jump from `<h2>` to `<h4>`). Visual hierarchy doesn't have to match (style with utility classes), but the DOM hierarchy must.

## Anti-patterns

- **`role="button"` on a `<div>`.** Use `<button>`.
- **Click handlers without keyboard equivalents.** A `<div onClick>` doesn't fire on Enter or Space — it's only mouse-accessible.
- **`autoFocus` everywhere.** One per page, max. Usually first form field.
- **Focus traps that the user can't escape.** Esc must close the trap.
- **Hiding focus rings with CSS.** Custom focus styles are fine; *removing* them isn't.
- **`tabIndex={-1}` on focusable elements.** Hides them from keyboard users.
- **Asserting on `getByTestId` instead of `getByRole`.** A passing test that uses test-id may have shipped a button without an accessible name.
- **No `alt` on `<img>`.** Either describe it or set `alt=""` for decoration.
- **Color-only error indication.** Add an icon and text.
- **`aria-label` that duplicates visible text.** Screen readers read both — confusing.

## Tooling

- **`@axe-core/react`** — runs axe in dev mode, surfaces violations in console.
- **`vitest-axe`** or `jest-axe` — assert no axe violations in component tests for high-risk components (forms, dialogs, complex widgets).
- **Lighthouse / DevTools Accessibility panel** — manual audits.
- **Keyboard testing** — actually navigate the route with Tab/Shift+Tab/Enter/Esc. If you can't, neither can the user.

## Cross-references

- `react-patterns` — semantic markup over `<div>` soup.
- `react-forms` — form a11y (label, aria-invalid, focus-on-error).
- `react-routing` — focus on route change.
- `repo-conventions` § Styling — Tailwind contrast tokens already meet AA.
- `playwright-best-practices` — e2e accessibility checks.
