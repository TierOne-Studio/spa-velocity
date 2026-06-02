import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVectordb } from '../services/vectordbs.service';
import { vectordbKeys } from './vectordbKeys';
import type { CreateVectordbInput, Vectordb } from '../types';

export function useCreateVectordb() {
  const queryClient = useQueryClient();

  return useMutation<Vectordb, Error, CreateVectordbInput>({
    mutationFn: (input) => createVectordb(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectordbKeys.all });
    },
  });
}
