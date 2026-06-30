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
import { cn } from "@/shared/lib/utils";
import type { EmbedSite } from "../types";
import {
  DEFAULT_WIDGET_THEME_ID,
  WIDGET_THEMES,
  type WidgetThemeId,
} from "../themes";
import { WidgetPreview } from "./WidgetPreview";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function buildEmbedSnippet(
  publicKey: string,
  apiBase = API_BASE_URL,
  theme?: WidgetThemeId,
): string {
  const themeAttr = theme ? `\n  data-theme="${theme}"` : "";
  return `<script\n  src="${apiBase}/api/public/widget/v1/widget.js"\n  data-embed-key="${publicKey}"\n  data-api-base="${apiBase}"${themeAttr}\n></script>`;
}

type Props = {
  site: EmbedSite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmbedCodeDialog({ site, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState(false);
  const [themeId, setThemeId] = useState<WidgetThemeId>(
    DEFAULT_WIDGET_THEME_ID,
  );
  const snippet = buildEmbedSnippet(site.publicKey, API_BASE_URL, themeId);
  const selectedTheme =
    WIDGET_THEMES.find((t) => t.id === themeId) ?? WIDGET_THEMES[0];

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
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Embed code — {site.name}</DialogTitle>
          <DialogDescription>
            Pick a theme, then paste this snippet into the HTML of any allowed
            site. The widget loads and authenticates with this site's
            publishable key.
          </DialogDescription>
        </DialogHeader>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Theme</legend>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="radiogroup"
            aria-label="Widget theme"
          >
            {WIDGET_THEMES.map((theme) => {
              const checked = theme.id === themeId;
              return (
                <label
                  key={theme.id}
                  className={cn(
                    "flex cursor-pointer flex-col gap-2 rounded-md border p-2 text-sm transition-colors",
                    checked
                      ? "border-primary ring-2 ring-primary"
                      : "border-input hover:bg-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="widget-theme"
                    value={theme.id}
                    checked={checked}
                    onChange={() => setThemeId(theme.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="flex h-10 overflow-hidden rounded border"
                    style={{ borderColor: theme.palette.border }}
                  >
                    <span
                      className="w-1/3"
                      style={{ background: theme.palette.headerBg }}
                    />
                    <span
                      className="flex-1"
                      style={{ background: theme.palette.surfaceColor }}
                    />
                    <span
                      className="w-1/4"
                      style={{ background: theme.palette.launcherBg }}
                    />
                  </span>
                  <span className="font-medium">{theme.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
              <code data-testid="embed-snippet">{snippet}</code>
            </pre>
          </div>
          <div className="flex justify-center">
            <WidgetPreview theme={selectedTheme} />
          </div>
        </div>

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
