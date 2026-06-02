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
  updateKnowledgeBaseSchema,
  type UpdateKnowledgeBaseForm,
} from "../schemas/knowledge-base.schema";
import { useUpdateKnowledgeBase } from "../hooks/useUpdateKnowledgeBase";
import type { KnowledgeBase } from "../types";

type Props = {
  knowledgeBase: KnowledgeBase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RenameKnowledgeBaseDialog({ knowledgeBase, open, onOpenChange }: Props) {
  const updateMutation = useUpdateKnowledgeBase();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateKnowledgeBaseForm>({
    resolver: zodResolver(updateKnowledgeBaseSchema),
    defaultValues: {
      name: knowledgeBase.name,
      description: knowledgeBase.description ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: knowledgeBase.name,
        description: knowledgeBase.description ?? "",
      });
    }
  }, [open, reset, knowledgeBase.name, knowledgeBase.description]);

  const onSubmit = async (values: UpdateKnowledgeBaseForm) => {
    const nameUnchanged = values.name.trim() === knowledgeBase.name;
    const descriptionUnchanged =
      (values.description ?? "") === (knowledgeBase.description ?? "");
    if (nameUnchanged && descriptionUnchanged) {
      onOpenChange(false);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: knowledgeBase.id,
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
