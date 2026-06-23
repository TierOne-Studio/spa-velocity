export type EmbedSiteQueryScope = {
  activeOrganizationId?: string | null;
  userId?: string | null;
};

export const embedSiteKeys = {
  all: ['embed-sites'] as const,

  lists: (scope?: EmbedSiteQueryScope) =>
    [
      ...embedSiteKeys.all,
      'list',
      scope?.userId ?? 'anonymous',
      scope?.activeOrganizationId ?? 'no-org',
    ] as const,

  detail: (id: string) => [...embedSiteKeys.all, 'detail', id] as const,
};
