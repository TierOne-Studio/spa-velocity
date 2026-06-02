import { fetchWithAuth } from '@/shared/lib/fetch-with-auth';
import { parseVectordbResponse } from '../lib/api-response';
import type {
  CreateVectordbInput,
  Vectordb,
  UpdateVectordbInput,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function kbUrl(path = ''): string {
  return `${API_BASE_URL}/api/vectordbs${path}`;
}

export async function listVectordb(): Promise<Vectordb[]> {
  const response = await fetchWithAuth(kbUrl());
  return parseVectordbResponse<Vectordb[]>(
    response,
    'Failed to fetch knowledge bases',
  );
}

export async function getVectordb(id: string): Promise<Vectordb> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`));
  return parseVectordbResponse<Vectordb>(
    response,
    `Failed to fetch knowledge base '${id}'`,
  );
}

export async function createVectordb(
  input: CreateVectordbInput,
): Promise<Vectordb> {
  const response = await fetchWithAuth(kbUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseVectordbResponse<Vectordb>(
    response,
    'Failed to create knowledge base',
  );
}

export async function updateVectordb(
  id: string,
  input: UpdateVectordbInput,
): Promise<Vectordb> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseVectordbResponse<Vectordb>(
    response,
    `Failed to update knowledge base '${id}'`,
  );
}

export async function deleteVectordb(id: string): Promise<void> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  await parseVectordbResponse<unknown>(
    response,
    `Failed to delete knowledge base '${id}'`,
  );
}
