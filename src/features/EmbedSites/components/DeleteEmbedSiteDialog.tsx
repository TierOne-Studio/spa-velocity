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
import { useDeleteEmbedSite } from "../hooks/useEmbedSiteMutations";
import type { EmbedSite } from "../types";

type Props = {
  site: EmbedSite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteEmbedSiteDialog({ site, open, onOpenChange }: Props) {
  const deleteMutation = useDeleteEmbedSite();
  const handleClose = () => onOpenChange(false);

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(site.id);
      toast.success(`Widget "${site.name}" deleted.`);
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete widget",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : handleClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Public Widget</DialogTitle>
          <DialogDescription>
            Permanently delete <strong>{site.name}</strong>. The embed snippet on
            any site using it will stop working immediately. This cannot be undone.
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
