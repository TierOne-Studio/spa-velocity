import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadVectorDb } from '../services/vectorDbService';
import { vectorDbKeys } from './vectorDbKeys';
import type { IngestionJob } from '../types';

type UploadInput = {
  vectorDbId: string;
  file: File;
  onProgress?: (percent: number) => void;
};

export function useUploadVectorDb() {
  const queryClient = useQueryClient();

  return useMutation<IngestionJob, Error, UploadInput>({
    mutationFn: ({ vectorDbId, file, onProgress }) =>
      uploadVectorDb(vectorDbId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorDbKeys.all });
    },
  });
}
