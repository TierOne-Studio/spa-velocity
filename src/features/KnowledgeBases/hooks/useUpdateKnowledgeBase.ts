import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateKnowledgeBase } from '../services/knowledge-bases.service';
import { knowledgeBaseKeys } from './knowledgeBaseKeys';
import type { KnowledgeBase, UpdateKnowledgeBaseInput } from '../types';

type UpdateKnowledgeBaseVars = {
  id: string;
  input: UpdateKnowledgeBaseInput;
};

export function useUpdateKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation<KnowledgeBase, Error, UpdateKnowledgeBaseVars>({
    mutationFn: ({ id, input }) => updateKnowledgeBase(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
      queryClient.setQueryData(knowledgeBaseKeys.detail(updated.id), updated);
    },
  });
}
