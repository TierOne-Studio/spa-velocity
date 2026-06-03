import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteVectorDbFile } from '../services/vectorDbService';
import { vectorDbKeys } from './vectorDbKeys';

type DeleteInput = { vectorDbId: string; jobId: string };

export function useDeleteVectorDbFile() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteInput>({
    mutationFn: ({ vectorDbId, jobId }) => deleteVectorDbFile(vectorDbId, jobId),
    onSuccess: (_data, { vectorDbId }) => {
      queryClient.invalidateQueries({ queryKey: vectorDbKeys.all });
      queryClient.invalidateQueries({ queryKey: [...vectorDbKeys.detail(vectorDbId), 'files'] });
    },
  });
}
