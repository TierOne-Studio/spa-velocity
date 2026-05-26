/**
 * HTTP client for Airweave **source-connection** endpoints + the connect
 * session helper used by both the OAuth create flow and the reauth flow.
 *
 * Per ADR-011 § Decision 7: PATCH/DELETE/REAUTH are ownership-gated
 * inline on the backend (one Airweave `get(id)` lookup → org check →
 * mutate), so the SPA does NOT need to fetch the collection first to
 * verify ownership. The backend returns 403 if cross-org.
 */

import { fetchWithAuth } from '@/shared/lib/fetch-with-auth';
import { parseAirweaveResponse } from '../lib/api-response';
import type {
  AirweaveSourceConnection,
  CreateSourceConnectionInput,
  CreateSourceConnectionResult,
  ReauthSourceConnectionResult,
  UpdateSourceConnectionInput,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── LIST by parent collection ────────────────────────────────────────────

export async function listSourceConnections(
  collectionReadableId: string,
): Promise<AirweaveSourceConnection[]> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/airweave/sources/${encodeURIComponent(collectionReadableId)}`,
  );
  return parseAirweaveResponse<AirweaveSourceConnection[]>(
    response,
    `Failed to list source connections for '${collectionReadableId}'`,
  );
}

// ── CREATE (discriminated by authentication.kind) ────────────────────────

export async function createSourceConnection(
  collectionReadableId: string,
  input: CreateSourceConnectionInput,
): Promise<CreateSourceConnectionResult> {
  // Backend accepts the same body shape verbatim — the discriminated
  // union is the wire format too. See api-velocity airweave.dto.ts.
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/airweave/collections/${encodeURIComponent(collectionReadableId)}/source-connections`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return parseAirweaveResponse<CreateSourceConnectionResult>(
    response,
    `Failed to create source connection in '${collectionReadableId}'`,
  );
}

// ── UPDATE / DELETE / REAUTH ─────────────────────────────────────────────

export async function updateSourceConnection(
  sourceConnectionId: string,
  input: UpdateSourceConnectionInput,
): Promise<AirweaveSourceConnection> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/airweave/source-connections/${encodeURIComponent(sourceConnectionId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return parseAirweaveResponse<AirweaveSourceConnection>(
    response,
    `Failed to update source connection '${sourceConnectionId}'`,
  );
}

export async function deleteSourceConnection(
  sourceConnectionId: string,
): Promise<void> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/airweave/source-connections/${encodeURIComponent(sourceConnectionId)}`,
    { method: 'DELETE' },
  );
  await parseAirweaveResponse<unknown>(
    response,
    `Failed to delete source connection '${sourceConnectionId}'`,
  );
}

export async function reauthSourceConnection(
  sourceConnectionId: string,
): Promise<ReauthSourceConnectionResult> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/airweave/source-connections/${encodeURIComponent(sourceConnectionId)}/reauth`,
    { method: 'POST' },
  );
  return parseAirweaveResponse<ReauthSourceConnectionResult>(
    response,
    `Failed to re-authenticate source connection '${sourceConnectionId}'`,
  );
}

// ── Connect session (legacy — used directly by reauth path on backend) ───
//
// The reauth endpoint above is the SPA's preferred entry point. The bare
// connect-session endpoint exists for the legacy `MultiSelectCombobox`
// flow in OrganizationsPage and remains available; we don't add new UI
// for it here.
export async function createConnectSession(
  collectionReadableId: string,
): Promise<{ sessionToken: string }> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/airweave/connect/session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId: collectionReadableId }),
    },
  );
  return parseAirweaveResponse<{ sessionToken: string }>(
    response,
    `Failed to create connect session for '${collectionReadableId}'`,
  );
}
