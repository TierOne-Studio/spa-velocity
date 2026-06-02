export type VectordbStatus = 'empty' | 'processing' | 'ready' | 'error';

export interface Vectordb {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  qdrantCollection: string;
  status: VectordbStatus;
  statusError: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVectordbInput {
  name: string;
  description?: string | null;
}

export interface UpdateVectordbInput {
  name?: string;
  description?: string | null;
}
