import { fetchWithAuth } from '@/shared/lib/fetch-with-auth';
import { VectorDbApiError, parseVectorDbResponse, requireVectorDbData } from '../lib/apiResponse';
import type {
  CreateVectorDbInput,
  IngestionJob,
  VectorDb,
  UpdateVectorDbInput,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function vectorDbUrl(path = ''): string {
  return `${API_BASE_URL}/api/vector-dbs${path}`;
}

export async function listVectorDb(): Promise<VectorDb[]> {
  const response = await fetchWithAuth(vectorDbUrl());
  return requireVectorDbData<VectorDb[]>(
    response,
    'Failed to fetch vector databases',
  );
}

export async function getVectorDb(id: string): Promise<VectorDb> {
  const response = await fetchWithAuth(vectorDbUrl(`/${encodeURIComponent(id)}`));
  return requireVectorDbData<VectorDb>(
    response,
    `Failed to fetch vector database '${id}'`,
  );
}

export async function createVectorDb(
  input: CreateVectorDbInput,
): Promise<VectorDb> {
  const response = await fetchWithAuth(vectorDbUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return requireVectorDbData<VectorDb>(
    response,
    'Failed to create vector database',
  );
}

export async function updateVectorDb(
  id: string,
  input: UpdateVectorDbInput,
): Promise<VectorDb> {
  const response = await fetchWithAuth(vectorDbUrl(`/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return requireVectorDbData<VectorDb>(
    response,
    `Failed to update vector database '${id}'`,
  );
}

export async function listVectorDbFiles(id: string): Promise<IngestionJob[]> {
  const response = await fetchWithAuth(vectorDbUrl(`/${encodeURIComponent(id)}/files`));
  return requireVectorDbData<IngestionJob[]>(response, `Failed to list files for vector database '${id}'`);
}

export async function deleteVectorDbFile(id: string, jobId: string): Promise<void> {
  const response = await fetchWithAuth(
    vectorDbUrl(`/${encodeURIComponent(id)}/files/${encodeURIComponent(jobId)}`),
    { method: 'DELETE' },
  );
  await parseVectorDbResponse<unknown>(response, `Failed to delete file '${jobId}'`);
}

export async function deleteVectorDb(id: string): Promise<void> {
  const response = await fetchWithAuth(vectorDbUrl(`/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  await parseVectorDbResponse<unknown>(
    response,
    `Failed to delete vector database '${id}'`,
  );
}

export function uploadVectorDb(
  id: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<IngestionJob> {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('bearer_token');
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed: unknown = JSON.parse(xhr.responseText);
          if (
            parsed !== null &&
            typeof parsed === 'object' &&
            (parsed as { data?: unknown }).data != null
          ) {
            resolve((parsed as { data: IngestionJob }).data);
          } else {
            reject(new VectorDbApiError('Invalid response from server', xhr.status, parsed));
          }
        } catch {
          reject(new VectorDbApiError('Invalid response from server', xhr.status, null));
        }
      } else {
        let body: unknown = {};
        try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        const message =
          typeof body === 'object' && body !== null &&
          typeof (body as { message?: unknown }).message === 'string'
            ? (body as { message: string }).message
            : `Failed to upload file to vector database '${id}'`;
        reject(new VectorDbApiError(message, xhr.status, body));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new VectorDbApiError('Network error during file upload', 0, null));
    });

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', vectorDbUrl(`/${encodeURIComponent(id)}/upload`));
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}
