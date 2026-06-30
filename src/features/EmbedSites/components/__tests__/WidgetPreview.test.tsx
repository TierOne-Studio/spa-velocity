import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetPreview } from "../WidgetPreview";
import { WIDGET_THEMES } from "../../themes";

const obsidian = WIDGET_THEMES.find((t) => t.id === "obsidian")!;

describe("WidgetPreview", () => {
  it("renders the rebranded chrome (AI Agent + Powered by Velocity)", () => {
    render(<WidgetPreview theme={obsidian} />);
    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText(/Powered by/i)).toBeInTheDocument();
  });

  it("exposes an accessible name describing the previewed theme", () => {
    render(<WidgetPreview theme={obsidian} />);
    expect(
      screen.getByRole("img", { name: /obsidian theme preview/i }),
    ).toBeInTheDocument();
  });

  it("applies the theme palette as --vw-* custom properties on the preview root", () => {
    render(<WidgetPreview theme={obsidian} />);
    const root = screen.getByRole("img", { name: /obsidian theme preview/i });
    expect(root.style.getPropertyValue("--vw-surface")).toBe("#161616");
    expect(root.style.getPropertyValue("--vw-header-bg")).toBe("#0a0a0a");
  });
});
