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
import { useDeleteVectorDb } from "../hooks/useDeleteVectorDb";
import type { VectorDb } from "../types";

type Props = {
  vectordb: VectorDb;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteVectorDbDialog({
  vectordb,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const deleteMutation = useDeleteVectorDb();

  const handleClose = () => onOpenChange(false);

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(vectordb.id);
      toast.success(`Knowledge base "${vectordb.name}" deleted.`);
      handleClose();
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete knowledge base");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : handleClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Knowledge Base</DialogTitle>
          <DialogDescription>
            Permanently delete <strong>{vectordb.name}</strong> and remove
            it from any projects it is attached to. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
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
