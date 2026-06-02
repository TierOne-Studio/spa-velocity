import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateVectordb } from '../services/vectordbs.service';
import { vectordbKeys } from './vectordbKeys';
import type { Vectordb, UpdateVectordbInput } from '../types';

type UpdateKnowledgeBaseVars = {
  id: string;
  input: UpdateVectordbInput;
};

export function useUpdateVectordb() {
  const queryClient = useQueryClient();

  return useMutation<Vectordb, Error, UpdateKnowledgeBaseVars>({
    mutationFn: ({ id, input }) => updateVectordb(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: vectordbKeys.all });
      queryClient.setQueryData(vectordbKeys.detail(updated.id), updated);
    },
  });
}
