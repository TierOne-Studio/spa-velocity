/**
 * HTTP client for Airweave **collection** endpoints.
 *
 * Mirrors the api-velocity controller surface in
 * `src/modules/airweave/api/controllers/airweave.controller.ts`. All
 * responses are `{data: T}` envelopes; this module unwraps them via
 * `parseAirweaveResponse`. Non-2xx throws a typed `AirweaveApiError` so
 * callers (hooks + components) can `instanceof`-check and read
 * structured 409 / 429 bodies.
 */

import { fetchWithAuth } from '@/shared/lib/fetch-with-auth';
import { parseAirweaveResponse } from '../lib/api-response';
import type {
  AirweaveCollection,
  AirweaveCollectionDetail,
  CreateCollectionInput,
  UpdateCollectionInput,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function collectionsUrl(path = ''): string {
  return `${API_BASE_URL}/api/airweave/collections${path}`;
}

export async function listCollections(
  search?: string,
): Promise<AirweaveCollection[]> {
  const url = new URL(collectionsUrl());
  if (search?.trim()) {
    url.searchParams.set('search', search.trim());
  }
  const response = await fetchWithAuth(url.toString());
  return parseAirweaveResponse<AirweaveCollection[]>(
    response,
    'Failed to fetch Airweave collections',
  );
}

export async function getCollection(
  collectionReadableId: string,
): Promise<AirweaveCollectionDetail> {
  const response = await fetchWithAuth(
    collectionsUrl(`/${encodeURIComponent(collectionReadableId)}`),
  );
  return parseAirweaveResponse<AirweaveCollectionDetail>(
    response,
    `Failed to fetch collection '${collectionReadableId}'`,
  );
}

export async function createCollection(
  input: CreateCollectionInput,
): Promise<AirweaveCollectionDetail> {
  const response = await fetchWithAuth(collectionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseAirweaveResponse<AirweaveCollectionDetail>(
    response,
    'Failed to create collection',
  );
}

export async function updateCollection(
  collectionReadableId: string,
  input: UpdateCollectionInput,
): Promise<AirweaveCollectionDetail> {
  const response = await fetchWithAuth(
    collectionsUrl(`/${encodeURIComponent(collectionReadableId)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return parseAirweaveResponse<AirweaveCollectionDetail>(
    response,
    `Failed to rename collection '${collectionReadableId}'`,
  );
}

export async function deleteCollection(
  collectionReadableId: string,
): Promise<void> {
  const response = await fetchWithAuth(
    collectionsUrl(`/${encodeURIComponent(collectionReadableId)}`),
    { method: 'DELETE' },
  );
  // 200 returns `{data: {deleted: true, collectionId}}` per the controller;
  // we don't surface it (caller cares about success vs. AirweaveApiError).
  // 409 surfaces `DeleteCollectionConflictBody` via the typed error.
  await parseAirweaveResponse<unknown>(
    response,
    `Failed to delete collection '${collectionReadableId}'`,
  );
}
