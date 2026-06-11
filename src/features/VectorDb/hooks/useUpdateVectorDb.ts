import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateVectorDb } from '../services/vectorDbService';
import { vectorDbKeys } from './vectorDbKeys';
import type { VectorDb, UpdateVectorDbInput } from '../types';

type UpdateVectorDbVars = {
  id: string;
  input: UpdateVectorDbInput;
};

export function useUpdateVectorDb() {
  const queryClient = useQueryClient();

  return useMutation<VectorDb, Error, UpdateVectorDbVars>({
    mutationFn: ({ id, input }) => updateVectorDb(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: vectorDbKeys.all });
      queryClient.setQueryData(vectorDbKeys.detail(updated.id), updated);
    },
  });
}
