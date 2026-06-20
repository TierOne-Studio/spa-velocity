import { useEffect } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { DialogActions } from "./DialogActions";

// Name-only validation, mirroring `updateAirweaveCollectionSchema` /
// `updateSourceConnectionSchema` (both are identical) — the backend re-validates.
const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
});
type RenameForm = z.infer<typeof renameSchema>;

type RenameEntityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  fieldId: string;
  currentName: string;
  successMessage: string;
  fallbackError: string;
  onRename: (name: string) => Promise<unknown>;
};

/**
 * Shared single-field rename dialog for Airweave entities (collections and
 * source connections — the two are structurally identical single-name-field
 * forms). Owns the form, reset-on-open, the "unchanged name → just close"
 * short-circuit, and success/error toasts. Callers supply the entity-specific
 * copy and the mutation via `onRename` (which receives the trimmed name).
 */
export function RenameEntityDialog({
  open,
  onOpenChange,
  title,
  description,
  fieldId,
  currentName,
  successMessage,
  fallbackError,
  onRename,
}: Readonly<RenameEntityDialogProps>) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RenameForm>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: currentName },
  });

  useEffect(() => {
    if (open) reset({ name: currentName });
  }, [open, reset, currentName]);

  const onSubmit = async (values: RenameForm) => {
    const trimmed = values.name.trim();
    if (trimmed === currentName) {
      onOpenChange(false);
      return;
    }
    try {
      await onRename(trimmed);
      toast.success(successMessage);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : fallbackError;
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={fieldId}>Name</FieldLabel>
              <Input
                id={fieldId}
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
