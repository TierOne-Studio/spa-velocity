import { fetchWithAuth } from '@/shared/lib/fetch-with-auth';
import {
  parseEmbedSiteResponse,
  requireEmbedSiteData,
} from '../lib/apiResponse';
import type {
  CreateEmbedSiteInput,
  EmbedSite,
  UpdateEmbedSiteInput,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function embedSiteUrl(path = ''): string {
  return `${API_BASE_URL}/api/embed-sites${path}`;
}

export async function listEmbedSites(): Promise<EmbedSite[]> {
  const response = await fetchWithAuth(embedSiteUrl());
  return requireEmbedSiteData<EmbedSite[]>(
    response,
    'Failed to fetch embed sites',
  );
}

export async function getEmbedSite(id: string): Promise<EmbedSite> {
  const response = await fetchWithAuth(
    embedSiteUrl(`/${encodeURIComponent(id)}`),
  );
  return requireEmbedSiteData<EmbedSite>(
    response,
    `Failed to fetch embed site '${id}'`,
  );
}

export async function createEmbedSite(
  input: CreateEmbedSiteInput,
): Promise<EmbedSite> {
  const response = await fetchWithAuth(embedSiteUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return requireEmbedSiteData<EmbedSite>(
    response,
    'Failed to create embed site',
  );
}

export async function updateEmbedSite(
  id: string,
  input: UpdateEmbedSiteInput,
): Promise<EmbedSite> {
  const response = await fetchWithAuth(
    embedSiteUrl(`/${encodeURIComponent(id)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return requireEmbedSiteData<EmbedSite>(
    response,
    `Failed to update embed site '${id}'`,
  );
}

export async function rotateEmbedSiteKey(id: string): Promise<EmbedSite> {
  const response = await fetchWithAuth(
    embedSiteUrl(`/${encodeURIComponent(id)}/rotate-key`),
    { method: 'POST' },
  );
  return requireEmbedSiteData<EmbedSite>(
    response,
    `Failed to rotate key for embed site '${id}'`,
  );
}

export async function deleteEmbedSite(id: string): Promise<void> {
  const response = await fetchWithAuth(
    embedSiteUrl(`/${encodeURIComponent(id)}`),
    { method: 'DELETE' },
  );
  await parseEmbedSiteResponse<unknown>(
    response,
    `Failed to delete embed site '${id}'`,
  );
}
