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
  createVectorDbSchema,
  type CreateVectorDbForm,
} from "../schemas/vector-db.schema";
import { useCreateVectorDb } from "../hooks/useCreateVectorDb";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateVectorDbDialog({ open, onOpenChange }: Props) {
  const createMutation = useCreateVectorDb();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateVectorDbForm>({
    resolver: zodResolver(createVectorDbSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (open) reset({ name: "", description: "" });
  }, [open, reset]);

  const onSubmit = async (values: CreateVectorDbForm) => {
    try {
      const kb = await createMutation.mutateAsync({
        name: values.name,
        description: values.description || null,
      });
      toast.success(`Knowledge base "${kb.name}" created.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create knowledge base");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Knowledge Base</DialogTitle>
          <DialogDescription>
            Creates a knowledge base owned by your organization. Upload documents
            after creation to make them searchable in chat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="kb-create-name">Name</FieldLabel>
              <Input
                id="kb-create-name"
                placeholder="Product documentation"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="kb-create-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="kb-create-description"
                placeholder="What this knowledge base contains"
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
              {isSubmitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
