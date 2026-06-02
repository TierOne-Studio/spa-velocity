import { z } from 'zod';

const trimmedString = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const createVectorDbSchema = z.object({
  name: trimmedString('Name'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateVectorDbSchema = z.object({
  name: trimmedString('Name'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type CreateVectorDbForm = z.infer<typeof createVectorDbSchema>;
export type UpdateVectorDbForm = z.infer<typeof updateVectorDbSchema>;
