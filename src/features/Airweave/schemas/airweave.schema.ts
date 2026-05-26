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
    .record(z.string(), z.unknown())
    .refine(
      (value) => Object.keys(value).length > 0,
      { message: 'At least one credential field is required' },
    ),
});

/**
 * BYOC (Bring Your Own Client) fields — optional. Required when the
 * source's `requires_byoc=true` (e.g., Slack on an Airweave account
 * without a preconfigured OAuth app). The dialog's "Advanced — bring
 * your own OAuth app" disclosure surfaces them. Backend forwards
 * verbatim per ADR-011 § Amendment 3 (2026-05-26).
 *
 * Each field is optional and treats empty strings as unset to avoid
 * forwarding `""` as a secret value to Airweave.
 */
const optionalSecret = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `${label} is too long (max 2048 chars)`)
    .optional()
    .or(z.literal(''))
    .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined));

export const createOAuthSourceConnectionSchema = z.object({
  name: trimmedString('Name'),
  shortName: trimmedString('Source identifier', 64),
  clientId: optionalSecret('Client ID'),
  clientSecret: optionalSecret('Client secret'),
  consumerKey: optionalSecret('Consumer key'),
  consumerSecret: optionalSecret('Consumer secret'),
  redirectUri: optionalSecret('Redirect URI'),
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
