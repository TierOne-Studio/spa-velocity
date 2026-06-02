import { fetchWithAuth } from '@/shared/lib/fetch-with-auth';
import { parseKnowledgeBaseResponse } from '../lib/api-response';
import type {
  CreateKnowledgeBaseInput,
  KnowledgeBase,
  UpdateKnowledgeBaseInput,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function kbUrl(path = ''): string {
  return `${API_BASE_URL}/api/knowledge-bases${path}`;
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const response = await fetchWithAuth(kbUrl());
  return parseKnowledgeBaseResponse<KnowledgeBase[]>(
    response,
    'Failed to fetch knowledge bases',
  );
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`));
  return parseKnowledgeBaseResponse<KnowledgeBase>(
    response,
    `Failed to fetch knowledge base '${id}'`,
  );
}

export async function createKnowledgeBase(
  input: CreateKnowledgeBaseInput,
): Promise<KnowledgeBase> {
  const response = await fetchWithAuth(kbUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseKnowledgeBaseResponse<KnowledgeBase>(
    response,
    'Failed to create knowledge base',
  );
}

export async function updateKnowledgeBase(
  id: string,
  input: UpdateKnowledgeBaseInput,
): Promise<KnowledgeBase> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseKnowledgeBaseResponse<KnowledgeBase>(
    response,
    `Failed to update knowledge base '${id}'`,
  );
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  const response = await fetchWithAuth(kbUrl(`/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  await parseKnowledgeBaseResponse<unknown>(
    response,
    `Failed to delete knowledge base '${id}'`,
  );
}
