import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useDeleteAirweaveCollection } from "@/features/Airweave/hooks/useDeleteAirweaveCollection";
import { AirweaveApiError } from "@/features/Airweave/lib/api-response";
import type { AirweaveCollection, DeleteCollectionConflictBody } from "@/features/Airweave/types";

type Props = {
  collection: AirweaveCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional — called after a successful delete (mutation resolved, toast
   * shown, dialog closed). Used by the detail page to navigate back to
   * the list once its URL becomes stale.
   */
  onDeleted?: () => void;
};

type DialogState =
  | { kind: "confirm" }
  | { kind: "in-use"; projects: Array<{ id: string; name: string }> };

/**
 * Two-state delete dialog.
 *
 *  1. **Confirm** — initial state: standard destructive-confirm pattern.
 *  2. **In use** — switched into after the backend returns 409 with a
 *     `projects: [{id,name}]` body (ADR-011 failure mode #4). Lists the
 *     blocking projects with deep-links to `/admin/projects/:id` so the
 *     user can detach the source there before retrying. Cancel returns
 *     to the list.
 *
 * No precedent for this state pattern in spa-velocity — this is the
 * first "delete-blocked-by-references" surface.
 */
export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [state, setState] = useState<DialogState>({ kind: "confirm" });
  const deleteMutation = useDeleteAirweaveCollection();

  const handleClose = () => {
    setState({ kind: "confirm" });
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(collection.readableId);
      toast.success(`Collection "${collection.name}" deleted.`);
      handleClose();
      onDeleted?.();
    } catch (error) {
      if (
        error instanceof AirweaveApiError &&
        error.status === 409 &&
        isConflictBody(error.body)
      ) {
        setState({ kind: "in-use", projects: error.body.projects });
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to delete collection";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : handleClose())}>
      <DialogContent>
        {state.kind === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete Collection</DialogTitle>
              <DialogDescription>
                Permanently delete <strong>{collection.name}</strong> and all of
                its source connections from Airweave. This cannot be undone.
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-amber-500" />
                Collection in use
              </DialogTitle>
              <DialogDescription>
                <strong>{collection.name}</strong> is referenced by{" "}
                {state.projects.length}{" "}
                {state.projects.length === 1 ? "project" : "projects"}.
                Detach the source on each project below, then try deleting again.
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {state.projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span className="font-medium truncate">{project.name}</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/admin/projects/${encodeURIComponent(project.id)}`}>
                      Open
                      <IconArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function isConflictBody(body: unknown): body is DeleteCollectionConflictBody {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { projects?: unknown }).projects)
  );
}
