import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Input } from "@/shared/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import {
  updateSourceConnectionSchema,
  type UpdateSourceConnectionForm,
} from "@/features/Airweave/schemas/airweave.schema";
import { useUpdateAirweaveSourceConnection } from "@/features/Airweave/hooks/useUpdateAirweaveSourceConnection";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";

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
}: Props) {
  const updateMutation = useUpdateAirweaveSourceConnection();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSourceConnectionForm>({
    resolver: zodResolver(updateSourceConnectionSchema),
    defaultValues: { name: sourceConnection.name },
  });

  useEffect(() => {
    if (open) reset({ name: sourceConnection.name });
  }, [open, reset, sourceConnection.name]);

  const onSubmit = async (values: UpdateSourceConnectionForm) => {
    if (values.name.trim() === sourceConnection.name) {
      onOpenChange(false);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        sourceConnectionId: sourceConnection.id,
        airweaveCollectionReadableId: sourceConnection.airweaveCollectionReadableId,
        input: { name: values.name.trim() },
      });
      toast.success("Source connection renamed.");
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to rename source connection";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Source Connection</DialogTitle>
          <DialogDescription>
            Changes only the display name. The source's identifier and
            credentials are unchanged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="airweave-source-rename-name">Name</FieldLabel>
              <Input
                id="airweave-source-rename-name"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
