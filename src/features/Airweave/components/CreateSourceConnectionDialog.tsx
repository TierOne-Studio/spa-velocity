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
  type CreateDirectSourceConnectionForm,
  type CreateOAuthSourceConnectionForm,
} from "@/features/Airweave/schemas/airweave.schema";
import { useCreateAirweaveSourceConnection } from "@/features/Airweave/hooks/useCreateAirweaveSourceConnection";
import { useAirweaveOAuthPortal } from "@/features/Airweave/hooks/useAirweaveOAuthPortal";
import { scrubSessionToken } from "@/features/Airweave/lib/scrub-session-token";
import { showPopupBlockedToast } from "@/features/Airweave/lib/popup-blocked-toast";

type Props = {
  collectionReadableId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the OAuth tab successfully kicks off a portal flow so
   * the detail page can render the persistent "OAuth in progress" banner.
   */
  onPortalOpened?: () => void;
};

type DirectFormShape = Omit<CreateDirectSourceConnectionForm, "credentials"> & {
  credentialsJson: string;
};

/**
 * Add a source connection — direct auth OR OAuth-via-portal (Step 5).
 *
 * Refactored from the Step-4b single-form dialog: now wraps the existing
 * direct-form in `<Tabs>` and adds an OAuth tab. Each tab is its own
 * `useForm` instance so values don't bleed between branches.
 *
 * OAuth flow:
 *   1. Backend creates the source connection in `pending` and issues a
 *      `sessionToken` (per ADR-011 § Decision 8).
 *   2. SPA opens the Airweave portal in a new tab with the token via
 *      `useAirweaveOAuthPortal` (security hardening: noopener,noreferrer
 *      + token scrubbing on any rendered error).
 *   3. User completes the OAuth at the upstream provider; returns to the
 *      SPA tab; `refetchOnWindowFocus` refreshes the source-connection
 *      list. The detail page also offers a persistent "in progress"
 *      banner with a manual refresh button.
 *   4. If the portal returns a `sessionToken` but `window.open` is
 *      blocked, the user sees a shared "allow popups + click Reauth"
 *      toast (no banner — banner is reserved for the success path).
 */
export function CreateSourceConnectionDialog({
  collectionReadableId,
  open,
  onOpenChange,
  onPortalOpened,
}: Props) {
  const createMutation = useCreateAirweaveSourceConnection();
  const portal = useAirweaveOAuthPortal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Source Connection</DialogTitle>
          <DialogDescription>
            Choose <strong>Direct</strong> for credential-based sources
            (Postgres, S3, API tokens) or <strong>OAuth</strong> for
            sources that need a browser handshake (Slack, Notion, Google
            Drive, …).
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">Direct</TabsTrigger>
            <TabsTrigger value="oauth" disabled={!portal.isAvailable}>
              OAuth
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct">
            <DirectAuthForm
              collectionReadableId={collectionReadableId}
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
            {portal.isAvailable ? (
              <OAuthForm
                collectionReadableId={collectionReadableId}
                isPending={createMutation.isPending}
                onSubmit={async (input) => {
                  try {
                    const result = await createMutation.mutateAsync({
                      collectionReadableId,
                      input: {
                        name: input.name,
                        shortName: input.shortName,
                        authentication: {
                          kind: "oauth",
                          redirectUri: input.redirectUri,
                        },
                      },
                    });
                    const token = result.sessionToken;
                    if (!token) {
                      // Backend should always return a token on the OAuth
                      // branch; surface the contract violation loudly.
                      toast.error(
                        "Source created but no OAuth session token was returned — please re-authenticate from the source row.",
                      );
                      onOpenChange(false);
                      return;
                    }
                    const opened = portal.open(token);
                    if (!opened) {
                      showPopupBlockedToast();
                      // Source is created; dialog closes so the user can
                      // see the new row + retry via its Reauth button.
                      onOpenChange(false);
                      return;
                    }
                    onPortalOpened?.();
                    toast.success(
                      "Source created — complete OAuth in the new tab.",
                    );
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
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                The Airweave OAuth portal is not configured in this
                environment. Set <code>VITE_AIRWEAVE_PORTAL_URL</code> to
                enable the OAuth tab. Direct-auth sources still work.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Direct-auth sub-form ──────────────────────────────────────────────────

function DirectAuthForm({
  collectionReadableId: _,
  isPending,
  onSubmit,
  onCancel,
}: {
  collectionReadableId: string;
  isPending: boolean;
  onSubmit: (data: {
    name: string;
    shortName: string;
    credentials: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [credentialsJsonError, setCredentialsJsonError] = useState<string | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DirectFormShape>({
    defaultValues: { name: "", shortName: "", credentialsJson: "{\n  \n}" },
  });

  useEffect(() => {
    reset({ name: "", shortName: "", credentialsJson: "{\n  \n}" });
    setCredentialsJsonError(null);
  }, [reset]);

  const submit = async (values: DirectFormShape) => {
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

    const validation = createDirectSourceConnectionSchema.safeParse({
      name: values.name,
      shortName: values.shortName,
      credentials,
    });
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
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
            {...register("name", { required: "Name is required" })}
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
            {...register("shortName", {
              required: "Source type is required",
            })}
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
            {...register("credentialsJson", {
              required: "Credentials are required",
            })}
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

// ── OAuth sub-form ────────────────────────────────────────────────────────

function OAuthForm({
  collectionReadableId: _,
  isPending,
  onSubmit,
  onCancel,
}: {
  collectionReadableId: string;
  isPending: boolean;
  onSubmit: (data: CreateOAuthSourceConnectionForm) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOAuthSourceConnectionForm>({
    resolver: zodResolver(createOAuthSourceConnectionSchema),
    defaultValues: { name: "", shortName: "", redirectUri: "" },
  });

  useEffect(() => {
    reset({ name: "", shortName: "", redirectUri: "" });
  }, [reset]);

  return (
    <form
      onSubmit={handleSubmit(async (values) =>
        onSubmit({ ...values, redirectUri: values.redirectUri || undefined }),
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
          <FieldLabel htmlFor="airweave-oauth-shortname">Source type</FieldLabel>
          <Input
            id="airweave-oauth-shortname"
            placeholder="slack"
            {...register("shortName")}
          />
          <FieldDescription>
            The Airweave OAuth connector identifier (<code>slack</code>,{" "}
            <code>notion</code>, <code>google_drive</code>, …).
          </FieldDescription>
          <FieldError errors={[errors.shortName]} />
        </Field>

        <Field data-invalid={Boolean(errors.redirectUri)}>
          <FieldLabel htmlFor="airweave-oauth-redirect">
            Redirect URI <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="airweave-oauth-redirect"
            type="url"
            placeholder="https://app.velocity/admin/airweave"
            {...register("redirectUri")}
          />
          <FieldDescription>
            Where Airweave should return the user after the OAuth flow.
            Defaults to a portal-side landing page when omitted.
          </FieldDescription>
          <FieldError errors={[errors.redirectUri]} />
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
