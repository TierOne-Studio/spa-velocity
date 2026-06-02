export type KnowledgeBaseQueryScope = {
  activeOrganizationId?: string | null;
  userId?: string | null;
};

export const knowledgeBaseKeys = {
  all: ['knowledge-bases'] as const,

  lists: (scope?: KnowledgeBaseQueryScope) =>
    [
      ...knowledgeBaseKeys.all,
      'list',
      scope?.userId ?? 'anonymous',
      scope?.activeOrganizationId ?? 'no-org',
    ] as const,

  detail: (id: string) =>
    [...knowledgeBaseKeys.all, 'detail', id] as const,
};
