import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { cn } from "@/shared/lib/utils";
import { createDirectSourceConnectionSchema } from "@/features/Airweave/schemas/airweave.schema";
import { useCreateAirweaveSourceConnection } from "@/features/Airweave/hooks/useCreateAirweaveSourceConnection";
import { scrubSessionToken } from "@/features/Airweave/lib/scrub-session-token";

type Props = {
  collectionReadableId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Form-value type for the direct-auth branch.
 *
 * `credentialsJson` is NOT in the Zod schema (the schema validates the
 * post-parse `credentials: Record<string, unknown>` shape). `handleSubmit`
 * runs the JSON parse first, then invokes the Zod resolver on the parsed
 * payload `{name, shortName, credentials}`. See architect LOW Q4.
 */
type DirectFormShape = {
  name: string;
  shortName: string;
  credentialsJson: string;
};

/**
 * Add a **direct-auth** source connection — for sources that take API
 * keys or DSNs (Postgres, S3, Stripe, …). The user supplies all the
 * credentials upfront and the source-connection is created synchronously
 * with an immediate sync kick-off.
 *
 * **OAuth-based sources (Slack, Notion, Google Drive, …) do NOT use this
 * dialog.** Per ADR-011 § Amendment 4 (2026-05-26), OAuth flows go
 * through the Airweave Connect catalog widget — opened from the page's
 * "Connect a source" button — which lets the user browse the full
 * connector catalog and authenticate inline. Pre-creating an OAuth
 * source-connection with a chosen `shortName` upfront (the pre-Amendment-4
 * design) broke the catalog UX and surfaced empty widgets when the
 * source required BYOC. The catalog widget is the canonical OAuth path.
 *
 * This dialog stays for the smaller surface where the catalog widget
 * is overkill (you already have a Postgres DSN in clipboard, etc.).
 */
export function CreateSourceConnectionDialog({
  collectionReadableId,
  open,
  onOpenChange,
}: Props) {
  const createMutation = useCreateAirweaveSourceConnection();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add direct source connection</DialogTitle>
          <DialogDescription>
            For sources that authenticate with API keys or connection
            strings (Postgres, S3, Stripe, …). For Slack, Notion, Google
            Drive, and other OAuth providers, use{" "}
            <strong>Connect a source</strong> on the collection page
            instead — it opens the Airweave catalog with the full source
            picker.
          </DialogDescription>
        </DialogHeader>

        <DirectAuthForm
          isPending={createMutation.isPending}
          onSubmit={async (input) => {
            try {
              await createMutation.mutateAsync({
                collectionReadableId,
                input: {
                  name: input.name,
                  shortName: input.shortName,
                  authentication: {
                    kind: "direct",
                    credentials: input.credentials,
                  },
                },
              });
              toast.success("Source connection created.");
              onOpenChange(false);
            } catch (error) {
              const message =
                error instanceof Error
                  ? scrubSessionToken(error.message)
                  : "Failed to create source connection";
              toast.error(message);
            }
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Direct-auth sub-form (JSON pre-parse + zodResolver) ──────────────────

function DirectAuthForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (data: {
    name: string;
    shortName: string;
    credentials: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [credentialsJsonError, setCredentialsJsonError] = useState<
    string | null
  >(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DirectFormShape>({
    defaultValues: { name: "", shortName: "", credentialsJson: "{\n  \n}" },
  });

  // Reset on mount (dialog opens fresh). Radix Dialog unmounts content
  // on close, so this effectively runs at every open.
  useEffect(() => {
    reset({ name: "", shortName: "", credentialsJson: "{\n  \n}" });
    setCredentialsJsonError(null);
  }, [reset]);

  const submit = async (values: DirectFormShape) => {
    // Step 1: parse JSON (this is what zodResolver can't do).
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

    // Step 2: validate the post-parse payload via the canonical Zod schema.
    const validation = createDirectSourceConnectionSchema.safeParse({
      name: values.name,
      shortName: values.shortName,
      credentials,
    });
    if (!validation.success) {
      const first = validation.error.issues[0];
      // Field-level errors surface in <FieldError>; credentials-shape
      // errors surface in the bespoke <p> below (Zod's `credentials`
      // refine fires for empty objects, etc.).
      if (first.path[0] === "credentials" || first.path.length === 0) {
        setCredentialsJsonError(first.message);
      } else {
        toast.error(first.message);
      }
      return;
    }

    setCredentialsJsonError(null);
    await onSubmit(validation.data);
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="pt-2">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="airweave-direct-name">Name</FieldLabel>
          <Input
            id="airweave-direct-name"
            placeholder="Production Postgres"
            autoFocus
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={Boolean(errors.shortName)}>
          <FieldLabel htmlFor="airweave-direct-shortname">
            Source type
          </FieldLabel>
          <Input
            id="airweave-direct-shortname"
            placeholder="postgresql"
            {...register("shortName")}
          />
          <FieldDescription>
            The Airweave connector identifier (<code>postgresql</code>,{" "}
            <code>s3</code>, <code>mysql</code>, …).
          </FieldDescription>
          <FieldError errors={[errors.shortName]} />
        </Field>

        <Field data-invalid={Boolean(credentialsJsonError)}>
          <FieldLabel htmlFor="airweave-direct-credentials">
            Credentials (JSON)
          </FieldLabel>
          <textarea
            id="airweave-direct-credentials"
            className={cn(
              "flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm font-mono",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            rows={8}
            placeholder='{ "host": "...", "user": "...", "password": "..." }'
            // a11y MED (review pass): announce parse errors via aria.
            aria-invalid={Boolean(credentialsJsonError)}
            aria-describedby={
              credentialsJsonError
                ? "airweave-direct-credentials-error"
                : undefined
            }
            {...register("credentialsJson")}
          />
          <FieldDescription>
            A JSON object whose shape matches the Airweave connector.
          </FieldDescription>
          {credentialsJsonError && (
            <p
              id="airweave-direct-credentials-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {credentialsJsonError}
            </p>
          )}
        </Field>
      </FieldGroup>

      <DialogFooter className="mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting || isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || isPending}>
          {isSubmitting || isPending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
