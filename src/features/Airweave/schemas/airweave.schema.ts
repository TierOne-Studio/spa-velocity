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
    .record(z.unknown())
    .refine(
      (value) => Object.keys(value).length > 0,
      'At least one credential field is required',
    ),
});

export const createOAuthSourceConnectionSchema = z.object({
  name: trimmedString('Name'),
  shortName: trimmedString('Source identifier', 64),
  redirectUri: z
    .string()
    .trim()
    .url('Redirect URI must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateSourceConnectionSchema = z.object({
  name: trimmedString('Name'),
});

// Inferred form types — use these in `useForm<typeof X>()` calls.
export type CreateCollectionForm = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionForm = z.infer<typeof updateCollectionSchema>;
export type CreateDirectSourceConnectionForm = z.infer<
  typeof createDirectSourceConnectionSchema
>;
export type CreateOAuthSourceConnectionForm = z.infer<
  typeof createOAuthSourceConnectionSchema
>;
export type UpdateSourceConnectionForm = z.infer<
  typeof updateSourceConnectionSchema
>;
