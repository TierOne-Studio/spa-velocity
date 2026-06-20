import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import {
  createAirweaveCollectionSchema,
  type CreateAirweaveCollectionForm,
} from "@/features/Airweave/schemas/airweave.schema";
import { useCreateAirweaveCollection } from "@/features/Airweave/hooks/useCreateAirweaveCollection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Create a new Airweave collection scoped to the active organization.
 *
 * On success: navigates to the new collection's detail page so the user
 * can immediately add source connections.
 *
 * On 409 (random-suffix collision or orphan from a prior failed create),
 * surfaces the backend message verbatim — it names the offending
 * `readable_id` per ADR-011 § Decision 10 + R5 audit-log message contract.
 */
export function CreateAirweaveCollectionDialog({ open, onOpenChange }: Readonly<Props>) {
  const navigate = useNavigate();
  const createMutation = useCreateAirweaveCollection();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAirweaveCollectionForm>({
    resolver: zodResolver(createAirweaveCollectionSchema),
    defaultValues: { name: "", slugHint: "" },
  });

  // Reset the form when the dialog re-opens so stale values don't appear.
  useEffect(() => {
    if (open) reset({ name: "", slugHint: "" });
  }, [open, reset]);

  const onSubmit = async (values: CreateAirweaveCollectionForm) => {
    try {
      const collection = await createMutation.mutateAsync({
        name: values.name,
        slugHint: values.slugHint || undefined,
      });
      toast.success(`Airweave Collection "${collection.name}" created.`);
      onOpenChange(false);
      navigate(
        `/admin/airweave/${encodeURIComponent(collection.readableId)}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create Airweave Collection";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Airweave Collection</DialogTitle>
          <DialogDescription>
            Creates an Airweave collection owned by your organization. Source
            connections (Slack, Notion, databases, etc.) are added on the
            detail page after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="airweave-create-name">Name</FieldLabel>
              <Input
                id="airweave-create-name"
                placeholder="My team's knowledge base"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.slugHint)}>
              <FieldLabel htmlFor="airweave-create-slug">
                Slug hint <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="airweave-create-slug"
                placeholder="team-knowledge"
                aria-invalid={Boolean(errors.slugHint)}
                {...register("slugHint")}
              />
              <FieldDescription>
                Lowercase letters, digits, and dashes only (max 32 chars). If
                omitted, the slug is derived from the name. The final identifier
                ends with an 8-character random suffix to avoid collisions.
              </FieldDescription>
              <FieldError errors={[errors.slugHint]} />
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
