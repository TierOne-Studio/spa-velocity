export type VectordbQueryScope = {
  activeOrganizationId?: string | null;
  userId?: string | null;
};

export const vectordbKeys = {
  all: ['vectordbs'] as const,

  lists: (scope?: VectordbQueryScope) =>
    [
      ...vectordbKeys.all,
      'list',
      scope?.userId ?? 'anonymous',
      scope?.activeOrganizationId ?? 'no-org',
    ] as const,

  detail: (id: string) =>
    [...vectordbKeys.all, 'detail', id] as const,
};
