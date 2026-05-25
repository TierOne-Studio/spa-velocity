import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCollection } from '../services/collections.service';
import { airweaveKeys } from './airweaveKeys';

/**
 * Delete a collection. Per ADR-011 failure mode #4, the backend returns
 * 409 with a `{projects: [{id,name}]}` body when active
 * `project_data_source` rows still reference the collection. The caller
 * inspects `AirweaveApiError.body.projects` to render the "in use by"
 * dialog state (see `DeleteCollectionDialog` in Step 3).
 *
 * On success (204 / 200 envelope), invalidates ALL airweave lists so
 * the deleted row disappears from the table AND from the legacy
 * OrganizationsPage allowlist combobox.
 */
export function useDeleteAirweaveCollection() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (collectionReadableId) => deleteCollection(collectionReadableId),
    onSuccess: (_data, collectionReadableId) => {
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
      queryClient.removeQueries({
        queryKey: airweaveKeys.detail(collectionReadableId),
      });
      queryClient.removeQueries({
        queryKey: airweaveKeys.sourceConnections(collectionReadableId),
      });
    },
  });
}
