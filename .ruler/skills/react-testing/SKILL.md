---
name: react-testing
description: Use when writing or reviewing tests for React code in this SPA — Vitest unit/component tests, Testing Library queries (priority order role > label > placeholder > test-id), `userEvent` interactions, async assertions, hook tests with wrappers, and the unit-vs-component-vs-e2e split. Pairs with `playwright-best-practices` for E2E patterns. NOT for non-React tests, e2e mechanics in detail, or the TDD process itself (use `tdd-workflow`).
---

# React Testing

This SPA uses Vitest + Testing Library for unit/component tests and Playwright for e2e (under `e2e/<module>/`). The project's test discipline is captured by the test-quality rubric in `tdd-workflow` (10 items) plus the layer-selection rules below.

## When this fires

- Writing a new component test.
- Writing a new hook test.
- Reviewing test queries — should this use role/label/test-id?
- Choosing between component test and e2e for a flow.

## When this does NOT fire

- The TDD process itself (use `tdd-workflow`).
- Pure logic tests with no React (unit test, no special pattern).
- Detailed Playwright mechanics (use `playwright-best-practices`).

## Layer selection (decide upfront)

| Layer | Use for |
|---|---|
| **Unit** (Vitest, no DOM) | Pure functions, schema, formatters, reducers, utils. Fastest. |
| **Component** (Vitest + jsdom + Testing Library) | Components, hooks (with wrappers), forms, dialogs, tabs, route-level UI states (loading/empty/error/success). |
| **E2E** (Playwright) | Cross-page workflows, route guards, auth flows, RBAC paths, organization switching, real backend integration. |

**Rule:** if two layers can prove the requirement, choose the lowest. A loading-state assertion is a component test, not an e2e.

## Hard rules — Testing Library

1. **Query priority: role → label → placeholder → text → testId.** A test that uses `getByRole('button', { name: 'Save' })` proves the button is accessible. A test that uses `getByTestId('save-btn')` doesn't.

2. **`userEvent` over `fireEvent`.** `userEvent.click(button)` simulates a real click cascade (focus → mousedown → mouseup → click). `fireEvent.click` skips intermediate events and breaks tests of focus/keyboard behavior.

3. **`async` queries for async UI.** `findByRole`, `findByText` retry until the element appears. Use them when state changes after a `userEvent` (mutation, query loading, dialog open). NEVER add arbitrary `await new Promise(r => setTimeout(r, X))` — that's flakiness.

4. **No assertions on internals.** No `expect(component.state.x).toBe(...)`. Test what the user sees: rendered text, ARIA attributes, tab order, role hierarchy.

5. **Mocks at boundaries only.** Mock the API client, the router, `useAuth`, `localStorage`, the third-party SDK. Don't mock the component under test or its internal helpers.

## Patterns

### Component test with providers

If the component depends on `QueryClient`, theme, router, or auth, wrap the render with the providers it needs:

```tsx
function renderWithProviders(ui: React.ReactElement, opts?: RenderOptions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
    opts,
  )
}
```

Keep one such helper per common combination; don't redefine in every test.

### Hook test

Hooks that need providers go through `renderHook` with the `wrapper` option:

```tsx
const { result } = renderHook(() => useChat(), {
  wrapper: ({ children }) => (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={mockAuth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  ),
})
```

### Asserting on toast / sonner

Sonner renders into a portal; `getByText('Project created')` works after `await screen.findByText(...)`.

### Asserting on error states

Trigger the error path (mock the API client to reject); assert the rendered error text or the `role="alert"` element.

### Asserting on accessibility

Use `axe-core` (via `@axe-core/react` or `vitest-axe`) for high-leverage component-level a11y checks. Don't put it in every test — overkill — but include it on dialogs, forms, and complex widgets.

## Anti-patterns

- **`getByTestId` first.** Test IDs are last resort. They couple tests to implementation details and skip the accessibility check that role/label gives you for free.
- **Snapshot tests for whole components.** Brittle, change-on-every-tweak, hide regressions in noise.
- **`fireEvent` instead of `userEvent`.** See above.
- **Awaiting `setTimeout` to "wait for re-render."** Use async queries.
- **Testing internals via `instance()` or refs.** Test observable behavior.
- **One mega-test that asserts five things.** Split into named tests per behavior.
- **Mocking `useAuth` differently in every test.** Centralize in a test-helper.

## E2E pointer

Playwright tests live in `e2e/<module>/` matching the npm scripts (`auth`, `admin`, `rbac`, `chat`, `admin-dashboard`, `dashboard`, `shared`, `api`). Stable selectors (role, label, text) before CSS. No arbitrary sleeps — wait on UI/network state. See `playwright-best-practices` for the full pattern catalog.

## Cross-references

- `tdd-workflow` — TDD process and the 10-item test-quality rubric.
- `failure-mode-analysis` — which states need tests.
- `accessibility` — semantic queries pull double duty as a11y checks.
- `react-forms` — testing form submit, validation, error states.
- `playwright-best-practices` — e2e mechanics.
