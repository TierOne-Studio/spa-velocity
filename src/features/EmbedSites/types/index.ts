// Embed site = public web-chat widget config (api-velocity SPEC-003). 1:1 with a
// project, org-owned. `publicKey` is a PUBLISHABLE identifier (not a secret) —
// safe to display and embed in a page. Dates arrive as ISO strings over JSON.
export interface EmbedSite {
  id: string;
  name: string;
  projectId: string;
  publicKey: string;
  allowedOrigins: string[];
  enabled: boolean;
  theme: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmbedSiteInput {
  name: string;
  projectId: string;
  allowedOrigins: string[];
  theme?: Record<string, unknown> | null;
}

export interface UpdateEmbedSiteInput {
  name?: string;
  allowedOrigins?: string[];
  enabled?: boolean;
  theme?: Record<string, unknown> | null;
}
