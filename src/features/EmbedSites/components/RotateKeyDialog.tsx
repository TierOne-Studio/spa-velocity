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
import { useRotateEmbedSiteKey } from "../hooks/useEmbedSiteMutations";
import type { EmbedSite } from "../types";

type Props = {
  site: EmbedSite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RotateKeyDialog({ site, open, onOpenChange }: Props) {
  const rotateMutation = useRotateEmbedSiteKey();
  const handleClose = () => onOpenChange(false);

  const handleConfirm = async () => {
    try {
      await rotateMutation.mutateAsync(site.id);
      toast.success(
        "Key rotated. Update the embed snippet on your sites with the new key.",
      );
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to rotate key",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : handleClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotate Embed Key</DialogTitle>
          <DialogDescription>
            Generate a new key for <strong>{site.name}</strong>. The current key
            stops working immediately, so any embed snippet using it must be
            updated. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={rotateMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={rotateMutation.isPending}>
            {rotateMutation.isPending ? "Rotating…" : "Rotate key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
