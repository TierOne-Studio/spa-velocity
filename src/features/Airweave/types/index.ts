// Types for the Airweave CRUD feature.
//
// These mirror the api-velocity DTOs in
// `src/modules/airweave/api/dto/airweave.dto.ts` and the response shapes
// returned by AirweaveService. Keep in sync with PR #23 + ADR-011.
//
// The `AirweaveCollection` summary type used to live in
// `src/features/Admin/types/index.ts`; this feature folder is now the
// SSoT and Admin re-exports from here.

/** Collection summary returned by LIST + by the response envelope of CREATE/UPDATE. */
export interface AirweaveCollection {
  id: string;
  name: string;
  readableId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  status: string | null;
  sourceConnectionCount: number;
}

/** Extended detail returned by GET /collections/:id (and the CREATE response). */
export interface AirweaveCollectionDetail extends AirweaveCollection {
  vectorSize: number;
  embeddingModelName: string;
}

export interface AirweaveSourceConnection {
  id: string;
  name: string;
  shortName: string;
  collectionReadableId: string;
  createdAt: string;
  updatedAt: string;
  isAuthenticated: boolean;
  entityCount: number;
  /**
   * Authentication method as reported by the Airweave SDK. Known values
   * include `direct`, `oauth_browser`, `oauth_token`, `oauth_byoc`,
   * `auth_provider`. The reauth flow only applies to `oauth_browser`.
   * Falls back to `'unknown'` when the SDK omits the field.
   */
  authMethod: string;
  status: string;
}

// ── Mutation inputs ──────────────────────────────────────────────────────

export interface CreateCollectionInput {
  /** Display name shown in the Airweave UI. */
  name: string;
  /**
   * Optional alphanumeric + dash slug (max 32 chars). When omitted, the
   * server derives the slug from `name`. See ADR-011 § Decision 3 for the
   * random-suffix shape of the resulting `readable_id`.
   */
  slugHint?: string;
}

export interface UpdateCollectionInput {
  name: string;
}

export interface DirectAuthCredentials {
  /** Source-specific credential bag (e.g. `{ token: 'xoxb-…' }`). */
  credentials: Record<string, unknown>;
}

export type CreateSourceConnectionInput =
  | {
      name: string;
      shortName: string;
      authentication: { kind: 'direct' } & DirectAuthCredentials;
    }
  | {
      name: string;
      shortName: string;
      authentication: {
        kind: 'oauth';
        /** Optional post-OAuth landing URL. */
        redirectUri?: string;
      };
    };

export interface UpdateSourceConnectionInput {
  name: string;
}

// ── Mutation responses ───────────────────────────────────────────────────

export interface CreateSourceConnectionResult {
  sourceConnection: AirweaveSourceConnection;
  /** Present only for the OAuth branch (the frontend opens the Airweave portal with this token). */
  sessionToken?: string;
}

export interface ReauthSourceConnectionResult {
  sessionToken: string;
}

// ── Error body shapes (typed for 409 / 429 handling) ─────────────────────

/** Body shape for DELETE /collections/:id when the collection is still referenced. */
export interface DeleteCollectionConflictBody {
  message: string;
  collectionReadableId: string;
  projects: Array<{ id: string; name: string }>;
}

/** Body shape for 429 rate-limit responses (see ADR-011 § Decision 12). */
export interface RateLimitBody {
  message?: string;
  retryAfterSeconds?: number;
}
