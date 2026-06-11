import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVectorDb } from '../services/vectorDbService';
import { vectorDbKeys } from './vectorDbKeys';
import type { CreateVectorDbInput, VectorDb } from '../types';

export function useCreateVectorDb() {
  const queryClient = useQueryClient();

  return useMutation<VectorDb, Error, CreateVectorDbInput>({
    mutationFn: (input) => createVectorDb(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorDbKeys.all });
    },
  });
}
