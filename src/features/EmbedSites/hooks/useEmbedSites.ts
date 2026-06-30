import { useQuery } from '@tanstack/react-query';
import { useEffectiveSession } from '@/shared/hooks/useEffectiveSession';
import { listEmbedSites } from '../services/embedSitesService';
import { embedSiteKeys } from './embedSiteKeys';

function useEmbedSiteQueryScope() {
  const { data: session } = useEffectiveSession();
  return {
    userId: session?.user?.id ?? null,
    activeOrganizationId:
      (session?.session as { activeOrganizationId?: string } | undefined)
        ?.activeOrganizationId ?? null,
  };
}

export function useEmbedSites() {
  const scope = useEmbedSiteQueryScope();

  return useQuery({
    queryKey: embedSiteKeys.lists(scope),
    queryFn: listEmbedSites,
  });
}
