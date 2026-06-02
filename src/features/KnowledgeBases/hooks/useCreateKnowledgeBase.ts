import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createKnowledgeBase } from '../services/knowledge-bases.service';
import { knowledgeBaseKeys } from './knowledgeBaseKeys';
import type { CreateKnowledgeBaseInput, KnowledgeBase } from '../types';

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation<KnowledgeBase, Error, CreateKnowledgeBaseInput>({
    mutationFn: (input) => createKnowledgeBase(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
    },
  });
}
