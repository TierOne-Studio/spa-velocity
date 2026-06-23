import { useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
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
import type { EmbedSite } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function buildEmbedSnippet(publicKey: string, apiBase = API_BASE_URL): string {
  return `<script src="${apiBase}/api/public/widget/v1/widget.js" data-embed-key="${publicKey}" data-api-base="${apiBase}"></script>`;
}

type Props = {
  site: EmbedSite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmbedCodeDialog({ site, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState(false);
  const snippet = buildEmbedSnippet(site.publicKey);

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        // Non-secure context (e.g. plain http) — clipboard API is unavailable.
        // The snippet stays selectable below for manual copy.
        throw new Error("Clipboard unavailable in this context");
      }
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("Embed snippet copied to clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically — select the snippet and copy it.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Embed code — {site.name}</DialogTitle>
          <DialogDescription>
            Paste this snippet into the HTML of any allowed site. The widget loads
            and authenticates with this site's publishable key.
          </DialogDescription>
        </DialogHeader>

        <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
          <code data-testid="embed-snippet">{snippet}</code>
        </pre>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleCopy}
            aria-label="Copy embed code"
          >
            {copied ? (
              <IconCheck className="mr-2 h-4 w-4" />
            ) : (
              <IconCopy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
