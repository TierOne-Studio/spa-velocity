import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useProjects } from "@features/Projects";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { cn } from "@/shared/lib/utils";
import {
  createEmbedSiteSchema,
  type CreateEmbedSiteForm,
} from "../schemas/embedSiteSchema";
import { parseOrigins } from "../lib/origins";
import { useCreateEmbedSite } from "../hooks/useEmbedSiteMutations";

const textareaClass = cn(
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]",
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateEmbedSiteDialog({ open, onOpenChange }: Props) {
  const createMutation = useCreateEmbedSite();
  const { data: projects, isLoading: projectsLoading } = useProjects();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmbedSiteForm>({
    resolver: zodResolver(createEmbedSiteSchema),
    defaultValues: { name: "", projectId: "", allowedOriginsText: "" },
  });

  useEffect(() => {
    if (open) reset({ name: "", projectId: "", allowedOriginsText: "" });
  }, [open, reset]);

  const onSubmit = async (values: CreateEmbedSiteForm) => {
    try {
      const site = await createMutation.mutateAsync({
        name: values.name,
        projectId: values.projectId,
        allowedOrigins: parseOrigins(values.allowedOriginsText),
      });
      toast.success(`Widget "${site.name}" created.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create widget",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Public Widget</DialogTitle>
          <DialogDescription>
            Create an embeddable chat widget for a project. Anonymous visitors on
            your allowed sites can ask questions grounded on that project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="embed-create-name">Name</FieldLabel>
              <Input
                id="embed-create-name"
                placeholder="Marketing site widget"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.projectId)}>
              <FieldLabel htmlFor="embed-create-project">Project</FieldLabel>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="embed-create-project"
                      aria-invalid={Boolean(errors.projectId)}
                    >
                      <SelectValue
                        placeholder={
                          projectsLoading ? "Loading projects…" : "Select a project"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                The widget answers only from this project's knowledge base.
              </FieldDescription>
              <FieldError errors={[errors.projectId]} />
            </Field>

            <Field data-invalid={Boolean(errors.allowedOriginsText)}>
              <FieldLabel htmlFor="embed-create-origins">Allowed origins</FieldLabel>
              <textarea
                id="embed-create-origins"
                className={textareaClass}
                placeholder={"https://example.com\nhttps://www.example.com"}
                aria-invalid={Boolean(errors.allowedOriginsText)}
                {...register("allowedOriginsText")}
              />
              <FieldDescription>
                One origin per line. Only these sites may embed the widget.
              </FieldDescription>
              <FieldError errors={[errors.allowedOriginsText]} />
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
