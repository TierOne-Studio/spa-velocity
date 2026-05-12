---
name: react-forms
description: Use when implementing or reviewing forms in this SPA — schema design with Zod, React Hook Form integration, field-level vs submit-level validation, error display, accessible markup, async submit handling. NOT for plain controlled inputs without validation, search inputs (often unmanaged), or generic component shape (use `react-patterns`).
---

# React Forms (React Hook Form + Zod)

The repo's form pattern is RHF for state management + Zod for schemas + `@hookform/resolvers/zod` to bridge them. Field components are Radix-based via the `<Field>`/`<FieldLabel>`/`<Input>`/`<FieldError>` compound. This skill encodes the pattern and the failure modes it prevents.

## When this fires

- Adding a new form (any inputs + submit).
- Modifying an existing form's validation schema.
- Reviewing error-display, focus-on-error, or accessibility on a form.

## When this does NOT fire

- A search/filter input that's not really a "form" (no submit, no schema).
- One-off controlled inputs in non-form contexts.

## Hard rules

1. **Schema lives in `schemas/<feature>Schemas.ts`.** Zod is the source of truth for the shape AND the error messages. Don't duplicate validation rules inline.

2. **`zodResolver` is the only resolver.** Don't write custom resolvers; if Zod can't express the rule, use a `superRefine` block in the schema.

3. **Errors are shown next to the field, not in a banner above the form.** Use `<FieldError>` with the field's error from `formState.errors`. Set `aria-invalid` and `aria-describedby` on the input — the existing `<Field>` compound already wires this.

4. **Submit-level errors (server-side) surface as a toast or as a top-of-form alert with role="alert".** Don't drop them into a single random field.

5. **`mode: 'onSubmit'` is the default.** Don't validate on every keystroke unless the field's content semantics require it (e.g., password strength meter). Live validation can be hostile UX.

6. **Disable the submit button while pending.** Re-enable on settle. Use the mutation/`isSubmitting` state, not a manual `useState`.

## Pattern

```tsx
// schemas/projectSchemas.ts
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().max(500).optional(),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

// views/CreateProjectForm.tsx
const form = useForm<CreateProjectInput>({
  resolver: zodResolver(createProjectSchema),
  defaultValues: { name: '', description: '' },
})

const createProject = useMutation({
  mutationFn: createProjectApi,
  onSuccess: () => { toast.success('Project created'); form.reset(); navigate('...') },
  onError: (err) => { toast.error(humanize(err)) },
})

return (
  <form onSubmit={form.handleSubmit((data) => createProject.mutate(data))} noValidate>
    <Field name="name">
      <FieldLabel>Name</FieldLabel>
      <Input {...form.register('name')} aria-invalid={!!form.formState.errors.name} />
      <FieldError errors={[form.formState.errors.name]} />
    </Field>
    {/* description field analogous */}
    <Button type="submit" disabled={createProject.isPending}>Create</Button>
  </form>
)
```

## Patterns to follow

- **Reset after submit success.** `form.reset()` (or reset to specific values) prevents the previous submission's data from surfacing on next open.
- **`form.handleSubmit` over manual `onSubmit={(e) => e.preventDefault(); validate(); ...}`.** The handler does prevention + validation + only-fire-on-valid wiring.
- **`Controller` for non-native inputs.** Radix Select / DatePicker / etc. that don't expose a native `ref` need `<Controller name="x" control={form.control} render={({ field }) => ...}/>`.
- **`watch` for cross-field rules.** When field B depends on field A, `watch('a')` and use it to render or compute. Don't `useState` mirror.
- **Server-side validation parity.** If the API rejects with a field-specific error, `form.setError('name', { message: ... })` to surface it on the field.

## Anti-patterns

- **`useState` per field.** Use RHF's `register`. One state machine, one source of truth.
- **Validation rules duplicated across schema + manual checks in the submit handler.** Schema is the source.
- **Disabling the submit button for "is form valid" without `mode: 'onChange'`.** Misleading — RHF doesn't compute `isValid` until validation runs.
- **Async validation in `superRefine` that hits the network on every keystroke.** Debounce, or move it to a separate `useQuery` with `enabled: form.formState.isSubmitting`.
- **`autoFocus` everywhere.** One per page max; usually the first field on form mount.
- **Native HTML5 validation alongside RHF.** Use `noValidate` on the `<form>` to disable browser validation; RHF/Zod is the source.
- **Dropping errors silently on submit failure.** Always surface either via `form.setError` or toast.

## Accessibility tie-ins

- Label every input. `<FieldLabel htmlFor="...">` is the existing compound.
- `aria-invalid` and `aria-describedby` for inputs with errors.
- `role="alert"` (or `aria-live="polite"`) on top-of-form error banners.
- Move focus to the first invalid field on submit failure: RHF's `shouldFocusError: true` (default) handles this — keep it on.

## Cross-references

- `accessibility` — focus, ARIA, keyboard, error-announcement.
- `frontend-security` — never log form values that contain credentials/PII.
- `react-data-fetching` — `useMutation` for submit handlers.
- `repo-conventions` § Forms — current `<Field>` compound and schema layout.
