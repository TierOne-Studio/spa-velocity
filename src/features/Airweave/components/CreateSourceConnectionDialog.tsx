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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { cn } from "@/shared/lib/utils";
import {
  createDirectSourceConnectionSchema,
  createOAuthSourceConnectionSchema,
} from "@/features/Airweave/schemas/airweave.schema";
import { useCreateAirweaveSourceConnection } from "@/features/Airweave/hooks/useCreateAirweaveSourceConnection";
import { scrubSessionToken } from "@/features/Airweave/lib/scrub-session-token";

type Props = {
  collectionReadableId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fires when the OAuth tab successfully kicks off the create+token
   * issuance. Page lifts the SDK modal (per ADR-011 § Amendment 2 +
   * architect HIGH #2): page-level `useAirweaveConnectModal` reads the
   * token from a ref the page sets in this callback, then calls
   * `open()` on the SDK modal. The dialog itself closes immediately —
   * it doesn't outlive the OAuth handshake.
   */
  onOAuthSubmit?: (sessionToken: string) => void;
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
 * Form-value type for the OAuth branch.
 *
 * Per ADR-011 § Amendment 2: no `redirectUri` field — the official
 * `@airweave/connect-react` SDK uses postMessage CONNECTION_CREATED /
 * CLOSE callbacks; redirect URIs are inherited dead-contract.
 */
type OAuthFormShape = {
  name: string;
  shortName: string;
};

/**
 * Add a source connection — direct auth OR OAuth-via-SDK.
 *
 * OAuth flow (per ADR-011 § Amendment 2 — postMessage transport, NOT
 * window.open):
 *   1. Backend creates the source connection in `pending` + issues a
 *      `sessionToken`.
 *   2. Dialog passes the token up via `onOAuthSubmit(token)` and closes.
 *   3. Page receives the token, stashes it in a ref, and triggers the
 *      SDK-driven `useAirweaveConnectModal.open()` (lifted to page level
 *      so the modal outlives the dialog's unmount cycle).
 *   4. SDK opens its iframe widget at `connect.airweave.ai`, exchanges
 *      the token via postMessage REQUEST_TOKEN/TOKEN_RESPONSE, and emits
 *      onSuccess(connectionId) or onClose('cancel'|'error') on completion.
 */
export function CreateSourceConnectionDialog({
  collectionReadableId,
  open,
  onOpenChange,
  onOAuthSubmit,
}: Props) {
  const createMutation = useCreateAirweaveSourceConnection();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Source Connection</DialogTitle>
          <DialogDescription>
            Choose <strong>Direct</strong> for credential-based sources
            (Postgres, S3, API tokens) or <strong>OAuth</strong> for
            sources that need a browser handshake (Slack, Notion, Google
            Drive, …). OAuth uses the official Airweave Connect widget;
            you don&apos;t leave Velocity.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">Direct</TabsTrigger>
            <TabsTrigger value="oauth">OAuth</TabsTrigger>
          </TabsList>

          <TabsContent value="direct">
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
          </TabsContent>

          <TabsContent value="oauth">
            <OAuthForm
              isPending={createMutation.isPending}
              onSubmit={async (input) => {
                try {
                  const result = await createMutation.mutateAsync({
                    collectionReadableId,
                    input: {
                      name: input.name,
                      shortName: input.shortName,
                      authentication: { kind: "oauth" },
                    },
                  });
                  const token = result.sessionToken;
                  if (!token) {
                    toast.error(
                      "Source created but no OAuth session token was returned — please use Reauth on the source row.",
                    );
                    onOpenChange(false);
                    return;
                  }
                  // Hand off to the page-level SDK modal. Page is alive;
                  // dialog can safely close now.
                  onOAuthSubmit?.(token);
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Direct-auth sub-form (zodResolver + JSON pre-parse) ──────────────────

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
      if (
        first.path[0] === "credentials" ||
        first.path.length === 0
      ) {
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
            {...register("credentialsJson")}
          />
          <FieldDescription>
            A JSON object whose shape matches the Airweave connector.
          </FieldDescription>
          {credentialsJsonError && (
            <p className="text-sm text-destructive">{credentialsJsonError}</p>
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

// ── OAuth sub-form (just name + shortName; SDK handles the rest) ─────────

function OAuthForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (data: OAuthFormShape) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OAuthFormShape>({
    resolver: zodResolver(createOAuthSourceConnectionSchema),
    defaultValues: { name: "", shortName: "" },
  });

  useEffect(() => {
    reset({ name: "", shortName: "" });
  }, [reset]);

  return (
    <form
      onSubmit={handleSubmit(async (values) =>
        onSubmit({ name: values.name, shortName: values.shortName }),
      )}
      noValidate
      className="pt-2"
    >
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="airweave-oauth-name">Name</FieldLabel>
          <Input
            id="airweave-oauth-name"
            placeholder="Acme Slack workspace"
            autoFocus
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={Boolean(errors.shortName)}>
          <FieldLabel htmlFor="airweave-oauth-shortname">
            Source type
          </FieldLabel>
          <Input
            id="airweave-oauth-shortname"
            placeholder="slack"
            {...register("shortName")}
          />
          <FieldDescription>
            The Airweave OAuth connector identifier (<code>slack</code>,{" "}
            <code>notion</code>, <code>google_drive</code>, …). Submitting
            opens the Airweave Connect widget where you&apos;ll complete
            the OAuth handshake; you never leave Velocity.
          </FieldDescription>
          <FieldError errors={[errors.shortName]} />
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
          {isSubmitting || isPending ? "Starting…" : "Start OAuth"}
        </Button>
      </DialogFooter>
    </form>
  );
}

