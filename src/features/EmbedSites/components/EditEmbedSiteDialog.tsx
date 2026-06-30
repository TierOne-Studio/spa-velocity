import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import { cn } from "@/shared/lib/utils";
import {
  editEmbedSiteSchema,
  type EditEmbedSiteForm,
} from "../schemas/embedSiteSchema";
import { parseOrigins } from "../lib/origins";
import { useUpdateEmbedSite } from "../hooks/useEmbedSiteMutations";
import type { EmbedSite } from "../types";

const textareaClass = cn(
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]",
);

type Props = {
  site: EmbedSite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditEmbedSiteDialog({ site, open, onOpenChange }: Props) {
  const updateMutation = useUpdateEmbedSite();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditEmbedSiteForm>({
    resolver: zodResolver(editEmbedSiteSchema),
    defaultValues: {
      name: site.name,
      allowedOriginsText: site.allowedOrigins.join("\n"),
      enabled: site.enabled,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: site.name,
        allowedOriginsText: site.allowedOrigins.join("\n"),
        enabled: site.enabled,
      });
    }
  }, [open, site, reset]);

  const onSubmit = async (values: EditEmbedSiteForm) => {
    try {
      await updateMutation.mutateAsync({
        id: site.id,
        input: {
          name: values.name,
          allowedOrigins: parseOrigins(values.allowedOriginsText),
          enabled: values.enabled,
        },
      });
      toast.success(`Widget "${values.name}" updated.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update widget",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Public Widget</DialogTitle>
          <DialogDescription>
            Update the widget name, allowed origins, and whether it is enabled.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="embed-edit-name">Name</FieldLabel>
              <Input
                id="embed-edit-name"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.allowedOriginsText)}>
              <FieldLabel htmlFor="embed-edit-origins">Allowed origins</FieldLabel>
              <textarea
                id="embed-edit-origins"
                className={textareaClass}
                aria-invalid={Boolean(errors.allowedOriginsText)}
                {...register("allowedOriginsText")}
              />
              <FieldDescription>One origin per line.</FieldDescription>
              <FieldError errors={[errors.allowedOriginsText]} />
            </Field>

            <Field orientation="horizontal">
              <Controller
                control={control}
                name="enabled"
                render={({ field }) => (
                  <Checkbox
                    id="embed-edit-enabled"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <FieldLabel htmlFor="embed-edit-enabled">
                Enabled (widget responds to requests)
              </FieldLabel>
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
