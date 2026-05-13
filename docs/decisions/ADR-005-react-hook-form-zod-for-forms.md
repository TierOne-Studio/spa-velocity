# ADR-005: React Hook Form + Zod for forms

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

Forms are the highest-density bug surface in a typical SPA: validation rules duplicate between client and server, error display drifts, accessibility regresses, and submit-state management gets reinvented per form. The team needs one canonical pattern.

Constraints:
- Schemas must be the single source of truth for the data shape (no duplicating field-by-field rules in submit handlers).
- Errors must render next to the field, with `aria-invalid` / `aria-describedby` / focus-on-error.
- The submit button must reflect mutation pending state.
- TypeScript-first: schema → inferred types → typed `useForm` generic.

Visible in: [`src/features/Auth/schemas/authSchemas.ts`](../../src/features/Auth/schemas/authSchemas.ts), [`src/features/Auth/views/LoginPage.tsx`](../../src/features/Auth/views/LoginPage.tsx).

## Decision

We use **[React Hook Form (RHF) 7](https://react-hook-form.com/)** + **[Zod 4](https://zod.dev/) + [`@hookform/resolvers/zod`](https://github.com/react-hook-form/resolvers)** for all forms with non-trivial validation. Schema lives in `<feature>/schemas/<feature>Schemas.ts`. The `<Field>` / `<FieldLabel>` / `<Input>` / `<FieldError>` compound primitive in `src/shared/components/ui/field.tsx` handles `aria-invalid`/`aria-describedby` wiring. Submit via `form.handleSubmit(onSubmit)` (`mode: 'onSubmit'` default; per-field `mode: 'onChange'` only when product UX demands it).

Errors render via `<FieldError errors={[errors.field]} />` next to the field. Server-side rejection surfaces via `form.setError(field, { message })` for field-specific errors and a toast for general errors.

## Alternatives considered

- **Formik** — earlier-generation forms library, larger bundle, slower at scale (more rerenders). Rejected for performance + bundle.
- **Plain `useState` per field** — no validation infra; team would reimplement RHF poorly. Rejected for footprint.
- **Native HTML5 validation alone** — no schema reuse, browser inconsistencies, accessibility/UX rough. Rejected.
- **Yup** (instead of Zod) — older, less TypeScript-first. Zod has better type inference and a smaller bundle. Rejected.
- **Valibot** — newer, lighter than Zod. Compelling but smaller ecosystem; revisit if bundle pressure on Zod becomes acute.

## Consequences

- **Positive:** schema-first (Zod), type inference end-to-end, RHF's uncontrolled-input model = fewer rerenders, ergonomic compound primitives, accessibility wired in by default.
- **Negative:** RHF's `Controller` API needed for non-native Radix inputs (extra ceremony for Select/DatePicker etc.); two libraries to learn (RHF + Zod).
- **Follow-ups:** if the form catalog grows, codify common patterns (multi-step forms, dependent fields, async validation) in `react-forms`.

## References

- [`src/features/Auth/schemas/authSchemas.ts`](../../src/features/Auth/schemas/authSchemas.ts).
- [`src/features/Auth/views/LoginPage.tsx`](../../src/features/Auth/views/LoginPage.tsx) and `SignupPage.tsx`.
- [`src/shared/components/ui/field.tsx`](../../src/shared/components/ui/field.tsx) — `<Field>` compound.
- [`react-forms`](../../.ruler/skills/react-forms/SKILL.md).
- [`repo-conventions`](../../.ruler/skills/repo-conventions/SKILL.md) § Forms.
