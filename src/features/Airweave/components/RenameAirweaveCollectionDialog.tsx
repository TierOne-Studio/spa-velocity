import { useUpdateAirweaveCollection } from "@/features/Airweave/hooks/useUpdateAirweaveCollection";
import type { AirweaveCollection } from "@/features/Airweave/types";
import { RenameEntityDialog } from "./RenameEntityDialog";

type Props = {
  collection: AirweaveCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Rename an existing collection. Per ADR-011 § Decision 13 the
 * `readable_id` is immutable on rename, so the detail-page URL remains
 * valid after this mutation completes. The mutation hook invalidates
 * both the list and the specific detail so the UI updates everywhere.
 */
export function RenameAirweaveCollectionDialog({
  collection,
  open,
  onOpenChange,
}: Readonly<Props>) {
  const updateMutation = useUpdateAirweaveCollection();

  return (
    <RenameEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename Airweave Collection"
      description={
        <>
          Changes only the display name. The internal identifier{" "}
          (<span className="font-mono text-xs">{collection.readableId}</span>) stays
          the same, so existing project references continue to work.
        </>
      }
      fieldId="airweave-rename-name"
      currentName={collection.name}
      successMessage="Airweave Collection renamed."
      fallbackError="Failed to rename Airweave Collection"
      onRename={(name) =>
        updateMutation.mutateAsync({
          airweaveCollectionReadableId: collection.readableId,
          input: { name },
        })
      }
    />
  );
}
