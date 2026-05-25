import { useEffect, useState } from "react";
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
import { cn } from "@/shared/lib/utils";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import {
  createDirectSourceConnectionSchema,
  type CreateDirectSourceConnectionForm,
} from "@/features/Airweave/schemas/airweave.schema";
import { useCreateAirweaveSourceConnection } from "@/features/Airweave/hooks/useCreateAirweaveSourceConnection";

type Props = {
  collectionReadableId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FormShape = Omit<CreateDirectSourceConnectionForm, "credentials"> & {
  credentialsJson: string;
};

/**
 * Add a new source connection to a collection — DIRECT auth only.
 *
 * Per the v1 slicing plan (Step 4b), this dialog ships with NO `<Tabs>`
 * and NO OAuth branch. Step 5 wraps it in `<Tabs>` and adds the OAuth
 * tab; the diff of that change is reviewable in isolation.
 *
 * Credentials are entered as a JSON object (e.g. `{"token": "xoxb-…"}`).
 * The per-connector schema is enforced by the Airweave backend, so any
 * 400 from upstream surfaces verbatim via the toast.
 */
export function CreateSourceConnectionDialog({
  collectionReadableId,
  open,
  onOpenChange,
}: Props) {
  const createMutation = useCreateAirweaveSourceConnection();
  const [credentialsJsonError, setCredentialsJsonError] = useState<string | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({
    defaultValues: { name: "", shortName: "", credentialsJson: "{\n  \n}" },
  });

  useEffect(() => {
    if (open) {
      reset({ name: "", shortName: "", credentialsJson: "{\n  \n}" });
      setCredentialsJsonError(null);
    }
  }, [open, reset]);

  const onSubmit = async (values: FormShape) => {
    let credentials: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(values.credentialsJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setCredentialsJsonError("Credentials must be a JSON object.");
        return;
      }
      credentials = parsed as Record<string, unknown>;
    } catch {
      setCredentialsJsonError("Credentials must be valid JSON.");
      return;
    }

    // Re-validate via the Zod schema (catches the name/shortName/empty-
    // credentials rules in one place).
    const validation = createDirectSourceConnectionSchema.safeParse({
      name: values.name,
      shortName: values.shortName,
      credentials,
    });
    if (!validation.success) {
      // Trigger the field errors via RHF by re-submitting through the
      // resolver path — simpler: surface the first issue as a toast.
      const first = validation.error.issues[0];
      toast.error(first.message);
      return;
    }

    try {
      await createMutation.mutateAsync({
        collectionReadableId,
        input: {
          name: validation.data.name,
          shortName: validation.data.shortName,
          authentication: {
            kind: "direct",
            credentials: validation.data.credentials,
          },
        },
      });
      toast.success("Source connection created.");
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create source connection";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Source Connection</DialogTitle>
          <DialogDescription>
            Connect a data source (e.g. Postgres, S3) using direct credentials.
            The Airweave backend validates the credential shape per connector.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="airweave-source-create-name">Name</FieldLabel>
              <Input
                id="airweave-source-create-name"
                placeholder="Production Postgres"
                aria-invalid={Boolean(errors.name)}
                autoFocus
                {...register("name", { required: "Name is required" })}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.shortName)}>
              <FieldLabel htmlFor="airweave-source-create-shortname">
                Source type
              </FieldLabel>
              <Input
                id="airweave-source-create-shortname"
                placeholder="postgresql"
                aria-invalid={Boolean(errors.shortName)}
                {...register("shortName", {
                  required: "Source type is required",
                })}
              />
              <FieldDescription>
                The Airweave connector identifier (e.g. <code>postgresql</code>,
                <code> s3</code>, <code>mysql</code>). See the Airweave catalog
                for the full list.
              </FieldDescription>
              <FieldError errors={[errors.shortName]} />
            </Field>

            <Field data-invalid={Boolean(credentialsJsonError)}>
              <FieldLabel htmlFor="airweave-source-create-credentials">
                Credentials (JSON)
              </FieldLabel>
              <textarea
                id="airweave-source-create-credentials"
                className={cn(
                  "flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm font-mono",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                rows={8}
                aria-invalid={Boolean(credentialsJsonError)}
                placeholder='{ "host": "...", "user": "...", "password": "..." }'
                {...register("credentialsJson", {
                  required: "Credentials are required",
                })}
              />
              <FieldDescription>
                A JSON object whose shape matches the Airweave connector.
                The backend rejects invalid shapes with a descriptive 400.
              </FieldDescription>
              {credentialsJsonError && (
                <p className="text-sm text-destructive">
                  {credentialsJsonError}
                </p>
              )}
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
