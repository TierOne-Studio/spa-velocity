/**
 * Widget theme presets surfaced in the embed-code modal (picker + preview).
 *
 * SSoT: the widget itself (api-velocity `public-chat/widget/theme.ts`
 * `THEME_PRESETS`) is the source of truth for how a theme actually renders.
 * The palettes below are a preview-only mirror, kept byte-identical to that
 * source via `__fixtures__/widget-theme-presets.json` and the deep-equal guard
 * in `__tests__/themes.test.ts`. When the widget palette changes, update the
 * fixture and these values together.
 *
 * Delivery is snippet-only: the chosen id is written into the embed `<script>`
 * as `data-theme="<id>"`; nothing is persisted to `embed_site.theme`.
 */

export type WidgetThemeId =
  | "cloud"
  | "obsidian"
  | "neo-brutalism"
  | "mono-chrome";

export interface WidgetThemePalette {
  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  headerBg: string;
  headerText: string;
  aiBubbleBg: string;
  aiBubbleText: string;
  userBubbleBg: string;
  userBubbleText: string;
  border: string;
  borderWidth: string;
  radius: string;
  shadow: string;
  launcherBg: string;
  launcherText: string;
  inputBg: string;
}

export interface WidgetTheme {
  id: WidgetThemeId;
  label: string;
  palette: WidgetThemePalette;
}

export const WIDGET_THEMES: readonly WidgetTheme[] = [
  {
    id: "cloud",
    label: "Cloud",
    palette: {
      primaryColor: "#6366f1",
      surfaceColor: "#f5f6fb",
      textColor: "#1e293b",
      mutedColor: "#94a3b8",
      headerBg: "#ffffff",
      headerText: "#1e293b",
      aiBubbleBg: "#ffffff",
      aiBubbleText: "#1e293b",
      userBubbleBg: "#ffffff",
      userBubbleText: "#1e293b",
      border: "#e5e7eb",
      borderWidth: "1px",
      radius: "16px",
      shadow: "0 16px 40px rgba(99,102,241,.20)",
      launcherBg: "#6366f1",
      launcherText: "#ffffff",
      inputBg: "#ffffff",
    },
  },
  {
    id: "obsidian",
    label: "Obsidian",
    palette: {
      primaryColor: "#3b82f6",
      surfaceColor: "#161616",
      textColor: "#e5e5e5",
      mutedColor: "#8a8a8a",
      headerBg: "#0a0a0a",
      headerText: "#fafafa",
      aiBubbleBg: "#1f1f1f",
      aiBubbleText: "#f0f0f0",
      userBubbleBg: "#2d2d2d",
      userBubbleText: "#fafafa",
      border: "#2e2e2e",
      borderWidth: "1px",
      radius: "12px",
      shadow: "0 16px 40px rgba(0,0,0,.55)",
      launcherBg: "#1a1a1a",
      launcherText: "#fafafa",
      inputBg: "#161616",
    },
  },
  {
    id: "neo-brutalism",
    label: "Neo Brutalism",
    palette: {
      primaryColor: "#facc15",
      surfaceColor: "#ffffff",
      textColor: "#000000",
      mutedColor: "#52525b",
      headerBg: "#000000",
      headerText: "#ffffff",
      aiBubbleBg: "#ffffff",
      aiBubbleText: "#000000",
      userBubbleBg: "#facc15",
      userBubbleText: "#000000",
      border: "#000000",
      borderWidth: "2px",
      radius: "6px",
      shadow: "4px 4px 0 #000000",
      launcherBg: "#000000",
      launcherText: "#facc15",
      inputBg: "#ffffff",
    },
  },
  {
    id: "mono-chrome",
    label: "Mono Chrome",
    palette: {
      primaryColor: "#000000",
      surfaceColor: "#ffffff",
      textColor: "#111111",
      mutedColor: "#6b7280",
      headerBg: "#000000",
      headerText: "#ffffff",
      aiBubbleBg: "#f3f4f6",
      aiBubbleText: "#111111",
      userBubbleBg: "#000000",
      userBubbleText: "#ffffff",
      border: "#111111",
      borderWidth: "1px",
      radius: "14px",
      shadow: "0 14px 32px rgba(0,0,0,.18)",
      launcherBg: "#000000",
      launcherText: "#ffffff",
      inputBg: "#ffffff",
    },
  },
];

export const DEFAULT_WIDGET_THEME_ID: WidgetThemeId = "cloud";

/**
 * Project a palette onto the widget's `--vw-*` CSS custom properties — the same
 * names the live widget sets (api-velocity `theme.ts` `themeToCssVars`). The
 * preview applies these as inline styles on a wrapper so it renders identically
 * to the embedded widget.
 */
export function paletteToCssVars(
  palette: WidgetThemePalette,
): Record<string, string> {
  return {
    "--vw-primary": palette.primaryColor,
    "--vw-surface": palette.surfaceColor,
    "--vw-text": palette.textColor,
    "--vw-muted": palette.mutedColor,
    "--vw-header-bg": palette.headerBg,
    "--vw-header-text": palette.headerText,
    "--vw-ai-bubble-bg": palette.aiBubbleBg,
    "--vw-ai-bubble-text": palette.aiBubbleText,
    "--vw-user-bubble-bg": palette.userBubbleBg,
    "--vw-user-bubble-text": palette.userBubbleText,
    "--vw-border": palette.border,
    "--vw-border-width": palette.borderWidth,
    "--vw-radius": palette.radius,
    "--vw-shadow": palette.shadow,
    "--vw-launcher-bg": palette.launcherBg,
    "--vw-launcher-text": palette.launcherText,
    "--vw-input-bg": palette.inputBg,
  };
}
