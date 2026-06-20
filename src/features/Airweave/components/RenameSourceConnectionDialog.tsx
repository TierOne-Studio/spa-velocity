import { useUpdateAirweaveSourceConnection } from "@/features/Airweave/hooks/useUpdateAirweaveSourceConnection";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";
import { RenameEntityDialog } from "./RenameEntityDialog";

type Props = {
  sourceConnection: AirweaveSourceConnection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Rename a single source connection. Backend gates ownership inline
 * via the parent collection (ADR-011 § Decision 7) — the SPA does not
 * fetch the collection first. A cross-org caller sees 403 via the
 * mutation's onError path; we surface the backend message via toast.
 */
export function RenameSourceConnectionDialog({
  sourceConnection,
  open,
  onOpenChange,
}: Readonly<Props>) {
  const updateMutation = useUpdateAirweaveSourceConnection();

  return (
    <RenameEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename Source Connection"
      description="Changes only the display name. The source's identifier and credentials are unchanged."
      fieldId="airweave-source-rename-name"
      currentName={sourceConnection.name}
      successMessage="Source connection renamed."
      fallbackError="Failed to rename source connection"
      onRename={(name) =>
        updateMutation.mutateAsync({
          sourceConnectionId: sourceConnection.id,
          airweaveCollectionReadableId: sourceConnection.airweaveCollectionReadableId,
          input: { name },
        })
      }
    />
  );
}
