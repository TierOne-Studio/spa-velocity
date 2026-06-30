/**
 * Widget theme presets surfaced in the embed-code modal (picker + preview).
 *
 * SSoT: the widget itself (api-velocity `public-chat/widget/theme.ts`
 * `THEME_PRESETS`) is the source of truth for how a theme actually renders.
 * `widget-theme-presets.json` (this dir) is the preview-only mirror of that
 * source and the single home for the palette data; `WIDGET_THEMES` below is
 * DERIVED from it (no inline duplicate). When the widget palette changes,
 * update that JSON to keep the preview in sync with the live widget.
 *
 * Delivery is snippet-only: the chosen id is written into the embed `<script>`
 * as `data-theme="<id>"`; nothing is persisted to `embed_site.theme`.
 */
import presetPalettes from "./widget-theme-presets.json";

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

// Palette data lives once, in the shared fixture; the inline list below carries
// only id + display label and pulls each palette from it (keeps Sonar happy and
// is genuinely DRY — no second copy of the 17 palette keys per preset).
// Cast via `unknown` because the JSON also carries a `_comment` string field,
// which doesn't structurally overlap with the palette record type.
const PRESET_PALETTES = presetPalettes as unknown as Record<
  string,
  WidgetThemePalette
>;

const THEME_LABELS: Record<WidgetThemeId, string> = {
  cloud: "Cloud",
  obsidian: "Obsidian",
  "neo-brutalism": "Neo Brutalism",
  "mono-chrome": "Mono Chrome",
};

// Stable display order of the selectable presets.
const THEME_ORDER: readonly WidgetThemeId[] = [
  "cloud",
  "obsidian",
  "neo-brutalism",
  "mono-chrome",
];

export const WIDGET_THEMES: readonly WidgetTheme[] = THEME_ORDER.map((id) => ({
  id,
  label: THEME_LABELS[id],
  palette: PRESET_PALETTES[id],
}));

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
