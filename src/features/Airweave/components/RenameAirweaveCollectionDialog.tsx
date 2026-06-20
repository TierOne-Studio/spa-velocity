import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { DialogActions } from "./DialogActions";
import { Input } from "@/shared/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import {
  updateAirweaveCollectionSchema,
  type UpdateAirweaveCollectionForm,
} from "@/features/Airweave/schemas/airweave.schema";
import { useUpdateAirweaveCollection } from "@/features/Airweave/hooks/useUpdateAirweaveCollection";
import type { AirweaveCollection } from "@/features/Airweave/types";

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
export function RenameAirweaveCollectionDialog({ collection, open, onOpenChange }: Readonly<Props>) {
  const updateMutation = useUpdateAirweaveCollection();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateAirweaveCollectionForm>({
    resolver: zodResolver(updateAirweaveCollectionSchema),
    defaultValues: { name: collection.name },
  });

  useEffect(() => {
    if (open) reset({ name: collection.name });
  }, [open, reset, collection.name]);

  const onSubmit = async (values: UpdateAirweaveCollectionForm) => {
    if (values.name.trim() === collection.name) {
      onOpenChange(false);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        airweaveCollectionReadableId: collection.readableId,
        input: { name: values.name.trim() },
      });
      toast.success("Airweave Collection renamed.");
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename Airweave Collection";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Airweave Collection</DialogTitle>
          <DialogDescription>
            Changes only the display name. The internal identifier{" "}
            (<span className="font-mono text-xs">{collection.readableId}</span>) stays
            the same, so existing project references continue to work.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="airweave-rename-name">Name</FieldLabel>
              <Input
                id="airweave-rename-name"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
          </FieldGroup>
          <DialogActions
            onCancel={() => onOpenChange(false)}
            submitLabel="Save"
            pendingLabel="Saving…"
            isPending={isSubmitting}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
