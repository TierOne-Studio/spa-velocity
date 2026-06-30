import { describe, expect, it } from "vitest";
import {
  WIDGET_THEMES,
  paletteToCssVars,
  type WidgetThemeId,
  type WidgetThemePalette,
} from "../themes";
// WIDGET_THEMES is derived from widget-theme-presets.json (the single home for
// the palette data, mirrored from api-velocity's THEME_PRESETS). These tests
// validate the SHAPE the UI consumes — order, labels, and that every preset
// carries the full palette — not a self-comparison against its own source.
const EXPECTED_PALETTE_KEYS: (keyof WidgetThemePalette)[] = [
  "primaryColor",
  "surfaceColor",
  "textColor",
  "mutedColor",
  "headerBg",
  "headerText",
  "aiBubbleBg",
  "aiBubbleText",
  "userBubbleBg",
  "userBubbleText",
  "border",
  "borderWidth",
  "radius",
  "shadow",
  "launcherBg",
  "launcherText",
  "inputBg",
];

describe("WIDGET_THEMES", () => {
  it("exposes exactly the four selectable presets, in a stable order", () => {
    expect(WIDGET_THEMES.map((t) => t.id)).toEqual([
      "cloud",
      "obsidian",
      "neo-brutalism",
      "mono-chrome",
    ]);
  });

  it("every theme has a human label", () => {
    for (const theme of WIDGET_THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
    }
  });

  it("every theme palette carries the full set of non-empty palette keys", () => {
    for (const theme of WIDGET_THEMES) {
      expect(Object.keys(theme.palette).sort()).toEqual(
        [...EXPECTED_PALETTE_KEYS].sort(),
      );
      for (const key of EXPECTED_PALETTE_KEYS) {
        expect(typeof theme.palette[key]).toBe("string");
        expect(theme.palette[key].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("paletteToCssVars", () => {
  it("projects a palette onto the widget's --vw-* custom properties", () => {
    const obsidian = WIDGET_THEMES.find(
      (t) => t.id === ("obsidian" satisfies WidgetThemeId),
    )!;
    const vars = paletteToCssVars(obsidian.palette);
    expect(vars["--vw-header-bg"]).toBe("#0a0a0a");
    expect(vars["--vw-surface"]).toBe("#161616");
    expect(vars["--vw-launcher-bg"]).toBe("#1a1a1a");
    expect(Object.keys(vars).every((k) => k.startsWith("--vw-"))).toBe(true);
  });
});
