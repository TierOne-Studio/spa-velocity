import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useDeleteAirweaveSourceConnection } from "@/features/Airweave/hooks/useDeleteAirweaveSourceConnection";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";

type Props = {
  sourceConnection: AirweaveSourceConnection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirm + delete a source connection. Backend cancels any in-flight
 * sync server-side (ADR-011 assumption A5) — no client-side draining.
 * Simpler than DeleteCollectionDialog: source connections don't have
 * the "still referenced by projects" failure mode.
 */
export function DeleteSourceConnectionDialog({
  sourceConnection,
  open,
  onOpenChange,
}: Props) {
  const deleteMutation = useDeleteAirweaveSourceConnection();

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync({
        sourceConnectionId: sourceConnection.id,
        collectionReadableId: sourceConnection.collectionReadableId,
      });
      toast.success(`Source connection "${sourceConnection.name}" deleted.`);
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete source connection";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Source Connection</DialogTitle>
          <DialogDescription>
            Permanently delete <strong>{sourceConnection.name}</strong> from
            this collection. Any in-flight sync will be cancelled. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
