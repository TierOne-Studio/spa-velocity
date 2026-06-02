import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteKnowledgeBase } from '../services/knowledge-bases.service';
import { knowledgeBaseKeys } from './knowledgeBaseKeys';

export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteKnowledgeBase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
    },
  });
}
