import { z } from 'zod';
import { isValidOrigin, parseOrigins } from '../lib/origins';

const name = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(255, 'Name must be at most 255 characters');

const allowedOriginsText = z.string().refine(
  (text) => {
    const origins = parseOrigins(text);
    return origins.length > 0 && origins.every(isValidOrigin);
  },
  { message: 'Enter at least one origin, one per line (e.g. https://example.com)' },
);

export const createEmbedSiteSchema = z.object({
  name,
  projectId: z.string().min(1, 'Project is required'),
  allowedOriginsText,
});

export const editEmbedSiteSchema = z.object({
  name,
  allowedOriginsText,
  enabled: z.boolean(),
});

export type CreateEmbedSiteForm = z.infer<typeof createEmbedSiteSchema>;
export type EditEmbedSiteForm = z.infer<typeof editEmbedSiteSchema>;
