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
  updateVectorDbSchema,
  type UpdateVectorDbForm,
} from "../schemas/vector-db.schema";
import { useUpdateVectorDb } from "../hooks/useUpdateVectorDb";
import type { VectorDb } from "../types";

type Props = {
  vectordb: VectorDb;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RenameVectorDbDialog({ vectordb, open, onOpenChange }: Props) {
  const updateMutation = useUpdateVectorDb();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateVectorDbForm>({
    resolver: zodResolver(updateVectorDbSchema),
    defaultValues: {
      name: vectordb.name,
      description: vectordb.description ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: vectordb.name,
        description: vectordb.description ?? "",
      });
    }
  }, [open, reset, vectordb.name, vectordb.description]);

  const onSubmit = async (values: UpdateVectorDbForm) => {
    const nameUnchanged = values.name.trim() === vectordb.name;
    const descriptionUnchanged =
      (values.description ?? "") === (vectordb.description ?? "");
    if (nameUnchanged && descriptionUnchanged) {
      onOpenChange(false);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: vectordb.id,
        input: {
          name: values.name.trim(),
          description: values.description?.trim() || null,
        },
      });
      toast.success("Knowledge base updated.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update knowledge base");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Knowledge Base</DialogTitle>
          <DialogDescription>
            Update the name or description of this knowledge base.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="kb-rename-name">Name</FieldLabel>
              <Input
                id="kb-rename-name"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="kb-rename-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="kb-rename-description"
                aria-invalid={Boolean(errors.description)}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
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
