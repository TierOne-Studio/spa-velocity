import { useQuery } from '@tanstack/react-query';
import { useEffectiveSession } from '@/shared/hooks/useEffectiveSession';
import { listKnowledgeBases } from '../services/knowledge-bases.service';
import { knowledgeBaseKeys } from './knowledgeBaseKeys';

function useKnowledgeBaseQueryScope() {
  const { data: session } = useEffectiveSession();
  return {
    userId: session?.user?.id ?? null,
    activeOrganizationId:
      (session?.session as { activeOrganizationId?: string } | undefined)
        ?.activeOrganizationId ?? null,
  };
}

export function useKnowledgeBases() {
  const scope = useKnowledgeBaseQueryScope();

  return useQuery({
    queryKey: knowledgeBaseKeys.lists(scope),
    queryFn: listKnowledgeBases,
  });
}
