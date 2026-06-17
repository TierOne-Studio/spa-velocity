// Single source of truth for Airweave TanStack Query keys.
//
// This file used to live as a private constant inside
// `src/features/Admin/hooks/useAirweaveCollections.ts`. The CRUD UI added
// in PR feat/airweave-collections-crud needed to invalidate collection
// queries from many new hooks, and a separate namespace would have
// fragmented the cache (per architect HIGH #1). Moved here as the
// canonical keys; the existing list hook imports from this location.
//
// Prefix `["admin", "airweave-collections"]` is preserved verbatim so the
// move does NOT invalidate any in-flight cache during the first deploy.
//
// Scope: per-org and per-user, so org-switching auto-invalidates the
// cache without a manual `invalidateQueries` call. Matches the project's
// established hierarchical key pattern (see useProjects keys for parallel
// example).

export type AirweaveCollectionQueryScope = {
  activeOrganizationId?: string | null;
  userId?: string | null;
};

export const airweaveKeys = {
  /** Root prefix — used by `queryClient.invalidateQueries({queryKey: airweaveKeys.all})`. */
  all: ['admin', 'airweave-collections'] as const,

  /** Collection LIST queries — scope + search-string narrowed. */
  lists: (
    search: string | null | undefined,
    scope?: AirweaveCollectionQueryScope,
  ) =>
    [
      ...airweaveKeys.all,
      'list',
      scope?.userId ?? 'anonymous',
      scope?.activeOrganizationId ?? 'no-org',
      search ?? '',
    ] as const,

  /** Single-collection detail by `readable_id`. */
  detail: (airweaveCollectionReadableId: string) =>
    [...airweaveKeys.all, 'detail', airweaveCollectionReadableId] as const,

  /** Source-connections list scoped to a parent collection. */
  sourceConnections: (airweaveCollectionReadableId: string) =>
    [
      ...airweaveKeys.all,
      'source-connections',
      airweaveCollectionReadableId,
    ] as const,
};

/**
 * Back-compat alias for the original constant name used in
 * `src/features/Admin/hooks/useAirweaveCollections.ts`. New code should
 * prefer `airweaveKeys`.
 */
export const airweaveCollectionKeys = airweaveKeys;
