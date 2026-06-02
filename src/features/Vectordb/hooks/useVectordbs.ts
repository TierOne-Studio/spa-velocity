import { useQuery } from '@tanstack/react-query';
import { useEffectiveSession } from '@/shared/hooks/useEffectiveSession';
import { listVectordb } from '../services/vectordbs.service';
import { vectordbKeys } from './vectordbKeys';

function useVectordbQueryScope() {
  const { data: session } = useEffectiveSession();
  return {
    userId: session?.user?.id ?? null,
    activeOrganizationId:
      (session?.session as { activeOrganizationId?: string } | undefined)
        ?.activeOrganizationId ?? null,
  };
}

export function useVectordbs() {
  const scope = useVectordbQueryScope();

  return useQuery({
    queryKey: vectordbKeys.lists(scope),
    queryFn: listVectordb,
  });
}
