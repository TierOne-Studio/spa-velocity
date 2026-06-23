import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createEmbedSite,
  deleteEmbedSite,
  rotateEmbedSiteKey,
  updateEmbedSite,
} from '../services/embedSitesService';
import { embedSiteKeys } from './embedSiteKeys';
import type {
  CreateEmbedSiteInput,
  EmbedSite,
  UpdateEmbedSiteInput,
} from '../types';

export function useCreateEmbedSite() {
  const queryClient = useQueryClient();
  return useMutation<EmbedSite, Error, CreateEmbedSiteInput>({
    mutationFn: (input) => createEmbedSite(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: embedSiteKeys.all });
    },
  });
}

export function useUpdateEmbedSite() {
  const queryClient = useQueryClient();
  return useMutation<EmbedSite, Error, { id: string; input: UpdateEmbedSiteInput }>({
    mutationFn: ({ id, input }) => updateEmbedSite(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: embedSiteKeys.all });
    },
  });
}

export function useRotateEmbedSiteKey() {
  const queryClient = useQueryClient();
  return useMutation<EmbedSite, Error, string>({
    mutationFn: (id) => rotateEmbedSiteKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: embedSiteKeys.all });
    },
  });
}

export function useDeleteEmbedSite() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteEmbedSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: embedSiteKeys.all });
    },
  });
}
