import { describe, expect, it } from "vitest";
import {
  WIDGET_THEMES,
  paletteToCssVars,
  type WidgetThemeId,
} from "../themes";
import presetFixture from "../__fixtures__/widget-theme-presets.json";

// Cross-repo SSoT guard: the four preview palettes MUST stay byte-identical to
// the widget's THEME_PRESETS (mirrored into widget-theme-presets.json). If the
// widget palette drifts and this fixture isn't updated, this test fails.
describe("WIDGET_THEMES cross-repo contract", () => {
  const { _comment: _ignored, ...fixturePalettes } = presetFixture as Record<
    string,
    unknown
  >;

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

  it("each theme palette is byte-identical to the shared fixture", () => {
    const runtime = Object.fromEntries(
      WIDGET_THEMES.map((t) => [t.id, t.palette]),
    );
    expect(runtime).toEqual(fixturePalettes);
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
