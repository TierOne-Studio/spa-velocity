import { fetchWithAuth } from '@/shared/lib/fetch-with-auth';
import { parseVectorDbResponse } from '../lib/api-response';
import type {
  CreateVectorDbInput,
  VectorDb,
  UpdateVectorDbInput,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function kbUrl(path = ''): string {
  return `${API_BASE_URL}/api/vector-dbs${path}`;
}

export async function listVectorDb(): Promise<VectorDb[]> {
  const response = await fetchWithAuth(kbUrl());
  return parseVectorDbResponse<VectorDb[]>(
    response,
    'Failed to fetch knowledge bases',
  );
}

export async function getVectorDb(id: string): Promise<VectorDb> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`));
  return parseVectorDbResponse<VectorDb>(
    response,
    `Failed to fetch knowledge base '${id}'`,
  );
}

export async function createVectorDb(
  input: CreateVectorDbInput,
): Promise<VectorDb> {
  const response = await fetchWithAuth(kbUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseVectorDbResponse<VectorDb>(
    response,
    'Failed to create knowledge base',
  );
}

export async function updateVectorDb(
  id: string,
  input: UpdateVectorDbInput,
): Promise<VectorDb> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseVectorDbResponse<VectorDb>(
    response,
    `Failed to update knowledge base '${id}'`,
  );
}

export async function deleteVectorDb(id: string): Promise<void> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  await parseVectorDbResponse<unknown>(
    response,
    `Failed to delete knowledge base '${id}'`,
  );
}
