import { Button } from "@/shared/components/ui/button";
import { DialogFooter } from "@/shared/components/ui/dialog";

type DialogActionsProps = {
  onCancel: () => void;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
};

/**
 * Standard "Cancel + submit" footer for the Airweave form dialogs. The submit
 * button is `type="submit"` (driven by the enclosing `<form>`) and shows
 * `pendingLabel` while the mutation is in flight. Extracted to remove the
 * footer block duplicated across the rename dialogs; renders the same DOM the
 * dialogs rendered inline.
 */
export function DialogActions({
  onCancel,
  submitLabel,
  pendingLabel,
  isPending,
}: Readonly<DialogActionsProps>) {
  return (
    <DialogFooter className="mt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isPending}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}
