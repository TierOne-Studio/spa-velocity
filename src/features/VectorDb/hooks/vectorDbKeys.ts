export type VectorDbQueryScope = {
  activeOrganizationId?: string | null;
  userId?: string | null;
};

export const vectorDbKeys = {
  all: ['vector-dbs'] as const,

  lists: (scope?: VectorDbQueryScope) =>
    [
      ...vectorDbKeys.all,
      'list',
      scope?.userId ?? 'anonymous',
      scope?.activeOrganizationId ?? 'no-org',
    ] as const,

  detail: (id: string) =>
    [...vectorDbKeys.all, 'detail', id] as const,
};
