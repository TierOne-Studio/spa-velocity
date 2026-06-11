import { useQuery } from '@tanstack/react-query';
import { listVectorDbFiles } from '../services/vectorDbService';
import { vectorDbKeys } from './vectorDbKeys';

export function useVectorDbFiles(vectorDbId: string) {
  return useQuery({
    queryKey: [...vectorDbKeys.detail(vectorDbId), 'files'],
    queryFn: () => listVectorDbFiles(vectorDbId),
    enabled: Boolean(vectorDbId),
  });
}
