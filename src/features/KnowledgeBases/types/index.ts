export type KnowledgeBaseStatus = 'empty' | 'processing' | 'ready' | 'error';

export interface KnowledgeBase {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  qdrantCollection: string;
  status: KnowledgeBaseStatus;
  statusError: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string | null;
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string | null;
}
