import { useQuery } from '@tanstack/react-query';
import { useEffectiveSession } from '@/shared/hooks/useEffectiveSession';
import { listVectorDb } from '../services/vectorDbService';
import { vectorDbKeys } from './vectorDbKeys';

function useVectorDbQueryScope() {
  const { data: session } = useEffectiveSession();
  return {
    userId: session?.user?.id ?? null,
    activeOrganizationId:
      (session?.session as { activeOrganizationId?: string } | undefined)
        ?.activeOrganizationId ?? null,
  };
}

export function useVectorDbs() {
  const scope = useVectorDbQueryScope();

  return useQuery({
    queryKey: vectorDbKeys.lists(scope),
    queryFn: listVectorDb,
  });
}
