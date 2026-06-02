import { z } from 'zod';

const trimmedString = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const createVectordbSchema = z.object({
  name: trimmedString('Name'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateVectordbSchema = z.object({
  name: trimmedString('Name'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type CreateVectordbForm = z.infer<typeof createVectordbSchema>;
export type UpdateVectordbForm = z.infer<typeof updateVectordbSchema>;
