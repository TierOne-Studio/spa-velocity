import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteVectordb } from '../services/vectordbs.service';
import { vectordbKeys } from './vectordbKeys';

export function useDeleteVectordb() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteVectordb(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectordbKeys.all });
    },
  });
}
