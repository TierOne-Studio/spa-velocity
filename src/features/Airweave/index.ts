// Public surface of the Airweave feature.
//
// Re-exports the load-bearing types, hooks, schemas, and utilities for
// external consumers (`Admin`, `Projects`, top-level routes). Internal
// helpers (`lib/api-response`, `lib/scrub-session-token`) stay
// non-exported — consumers outside this feature should never need them.

export type {
  AirweaveCollection,
  AirweaveCollectionDetail,
  AirweaveSourceConnection,
  CreateCollectionInput,
  CreateSourceConnectionInput,
  CreateSourceConnectionResult,
  DeleteCollectionConflictBody,
  RateLimitBody,
  ReauthSourceConnectionResult,
  UpdateCollectionInput,
  UpdateSourceConnectionInput,
} from './types';

export {
  airweaveKeys,
  airweaveCollectionKeys,
  type CollectionQueryScope,
} from './hooks/airweaveKeys';

// Schemas are surfaced so other features (e.g. Projects' future
// inline-create dialog) can reuse the same validation contract.
//
// ADR-011 § Amendment 4 (2026-05-26): `createOAuthSourceConnectionSchema`
// + `CreateOAuthSourceConnectionForm` were removed when the OAuth
// source-create flow moved into the Airweave Connect catalog widget.
// Direct-auth is the only Velocity-side source-create surface.
export {
  createCollectionSchema,
  updateCollectionSchema,
  createDirectSourceConnectionSchema,
  updateSourceConnectionSchema,
  type CreateCollectionForm,
  type UpdateCollectionForm,
  type CreateDirectSourceConnectionForm,
  type UpdateSourceConnectionForm,
} from './schemas/airweave.schema';

// Hooks — TanStack Query wrappers around the service layer.
export { useAirweaveCollectionDetail } from './hooks/useAirweaveCollectionDetail';
export { useAirweaveSourceConnections } from './hooks/useAirweaveSourceConnections';
export { useCreateAirweaveCollection } from './hooks/useCreateAirweaveCollection';
export { useUpdateAirweaveCollection } from './hooks/useUpdateAirweaveCollection';
export { useDeleteAirweaveCollection } from './hooks/useDeleteAirweaveCollection';
export { useCreateAirweaveSourceConnection } from './hooks/useCreateAirweaveSourceConnection';
export { useUpdateAirweaveSourceConnection } from './hooks/useUpdateAirweaveSourceConnection';
export { useDeleteAirweaveSourceConnection } from './hooks/useDeleteAirweaveSourceConnection';
export { useReauthAirweaveSourceConnection } from './hooks/useReauthAirweaveSourceConnection';

// Typed error from the service layer — consumers `instanceof`-check
// against this to unwrap structured 409/429 bodies.
export { AirweaveApiError } from './lib/api-response';

// Security: render-time scrubber for any string that might contain a
// portal-flow session token (toasts, error messages, console logs).
export { scrubSessionToken } from './lib/scrub-session-token';
