/**
 * Zod schemas for Airweave form inputs (RHF resolvers).
 *
 * Validation rules mirror api-velocity's controller-side validation in
 * `airweave.controller.ts` (`requireTrimmedString` + `requireValidSlugHint`).
 * The backend re-validates on every request, so these schemas are for UX
 * feedback only — never the authoritative gate.
 */

import { z } from 'zod';

const trimmedString = (label: string, max = 100) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** Matches api-velocity `requireValidSlugHint` regex. */
const SLUG_HINT_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCollectionSchema = z.object({
  name: trimmedString('Name'),
  slugHint: z
    .string()
    .trim()
    .max(32, 'slugHint must be at most 32 characters')
    .regex(
      SLUG_HINT_REGEX,
      'slugHint must contain only lowercase letters, digits, and dashes (no leading/trailing/consecutive dashes)',
    )
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /**
   * Target organization that will own the collection (ADR-011 amendment 5/6).
   * Single-org users: defaulted to their org (the picker is hidden). Multi-org
   * users: chosen via OrgTargetField. Superadmin: any org. The backend
   * re-validates membership (non-superadmin) and org-existence (everyone).
   */
  organizationId: z.string().trim().min(1).nullable().optional(),
});

export const updateCollectionSchema = z.object({
  name: trimmedString('Name'),
});

export const createDirectSourceConnectionSchema = z.object({
  name: trimmedString('Name'),
  shortName: trimmedString('Source identifier', 64),
  /**
   * Credential bag as a JSON object. The dialog renders this as a
   * key/value editor (or JSON textarea) and parses to a plain object
   * before validation. We accept any record — the backend validates
   * per-source via Airweave's connector schema.
   */
  credentials: z
    .record(z.string(), z.unknown())
    .refine(
      (value) => Object.keys(value).length > 0,
      { message: 'At least one credential field is required' },
    ),
});

// ADR-011 § Amendment 4 (2026-05-26): `createOAuthSourceConnectionSchema`
// removed. OAuth source-connection creation no longer happens through a
// Velocity-side form — the Airweave Connect catalog widget handles
// source selection, BYOC entry, and authentication inline. Keep this
// schema file focused on the direct-auth path that we still own.

export const updateSourceConnectionSchema = z.object({
  name: trimmedString('Name'),
});

// Inferred form types — use these in `useForm<typeof X>()` calls.
export type CreateCollectionForm = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionForm = z.infer<typeof updateCollectionSchema>;
export type CreateDirectSourceConnectionForm = z.infer<
  typeof createDirectSourceConnectionSchema
>;
// `CreateOAuthSourceConnectionForm` removed in ADR-011 § Amendment 4.
export type UpdateSourceConnectionForm = z.infer<
  typeof updateSourceConnectionSchema
>;
