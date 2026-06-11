import { z } from 'zod';

const trimmedString = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

// `.optional()` alone leaves '' as a valid string, so normalize '' → undefined after trim.
const optionalDescription = z
  .string()
  .trim()
  .max(1000, 'Description must be at most 1000 characters')
  .transform((value) => (value === '' ? undefined : value))
  .optional();

export const createVectorDbSchema = z.object({
  name: trimmedString('Name'),
  description: optionalDescription,
});

export const updateVectorDbSchema = z.object({
  name: trimmedString('Name'),
  description: optionalDescription,
});

export type CreateVectorDbForm = z.infer<typeof createVectorDbSchema>;
export type UpdateVectorDbForm = z.infer<typeof updateVectorDbSchema>;
