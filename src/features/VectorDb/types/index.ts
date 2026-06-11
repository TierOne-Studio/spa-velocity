export type VectorDbStatus = 'empty' | 'processing' | 'ready' | 'error';
export type IngestionJobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface VectorDb {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  vectorStoreKind: string;
  vectorStoreRef: string;
  status: VectorDbStatus;
  statusError: { message: string } | null;
  documentCount: number;
  version: number;
  processingStartedAt: string | null;
  lastIngestedAt: string | null;
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

export interface IngestionJob {
  id: string;
  vectorDbId: string;
  s3Key: string;
  originalFilename: string;
  fileSizeBytes: string;
  contentType: string;
  status: IngestionJobStatus;
  createdAt: string;
  updatedAt: string;
}
