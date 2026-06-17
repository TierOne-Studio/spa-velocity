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
  CreateAirweaveCollectionInput,
  UpdateAirweaveCollectionInput,
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
  airweaveCollectionReadableId: string,
): Promise<AirweaveCollectionDetail> {
  const response = await fetchWithAuth(
    collectionsUrl(`/${encodeURIComponent(airweaveCollectionReadableId)}`),
  );
  return parseAirweaveResponse<AirweaveCollectionDetail>(
    response,
    `Failed to fetch collection '${airweaveCollectionReadableId}'`,
  );
}

export async function createCollection(
  input: CreateAirweaveCollectionInput,
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
  airweaveCollectionReadableId: string,
  input: UpdateAirweaveCollectionInput,
): Promise<AirweaveCollectionDetail> {
  const response = await fetchWithAuth(
    collectionsUrl(`/${encodeURIComponent(airweaveCollectionReadableId)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return parseAirweaveResponse<AirweaveCollectionDetail>(
    response,
    `Failed to rename collection '${airweaveCollectionReadableId}'`,
  );
}

export async function deleteCollection(
  airweaveCollectionReadableId: string,
): Promise<void> {
  const response = await fetchWithAuth(
    collectionsUrl(`/${encodeURIComponent(airweaveCollectionReadableId)}`),
    { method: 'DELETE' },
  );
  // 200 returns `{data: {deleted: true, airweaveCollectionId}}` per the controller;
  // we don't surface it (caller cares about success vs. AirweaveApiError).
  // 409 surfaces `DeleteAirweaveCollectionConflictBody` via the typed error.
  await parseAirweaveResponse<unknown>(
    response,
    `Failed to delete collection '${airweaveCollectionReadableId}'`,
  );
}
