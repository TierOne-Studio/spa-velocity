export type VectorDbStatus = 'empty' | 'processing' | 'ready' | 'error';

export interface VectorDb {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  qdrantCollection: string;
  status: VectorDbStatus;
  statusError: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVectorDbInput {
  name: string;
  description?: string | null;
}

export interface UpdateVectorDbInput {
  name?: string;
  description?: string | null;
}
