import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteVectorDb } from '../services/vector-dbs.service';
import { vectorDbKeys } from './vectorDbKeys';

export function useDeleteVectorDb() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteVectorDb(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorDbKeys.all });
    },
  });
}
