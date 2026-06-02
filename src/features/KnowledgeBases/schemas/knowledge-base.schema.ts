import { z } from 'zod';

const trimmedString = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const createKnowledgeBaseSchema = z.object({
  name: trimmedString('Name'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateKnowledgeBaseSchema = z.object({
  name: trimmedString('Name'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type CreateKnowledgeBaseForm = z.infer<typeof createKnowledgeBaseSchema>;
export type UpdateKnowledgeBaseForm = z.infer<typeof updateKnowledgeBaseSchema>;
