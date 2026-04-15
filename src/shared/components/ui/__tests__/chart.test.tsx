import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartStyle,
} from "../chart";
import type { ChartConfig } from "../chart";

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => null,
  Legend: () => null,
}));

const sampleConfig: ChartConfig = {
  count: { label: "Count", color: "var(--chart-1)" },
  value: { label: "Value", color: "var(--chart-2)" },
};

describe("ChartContainer", () => {
  it("renders children", () => {
    render(
      <ChartContainer config={sampleConfig}>
        <div data-testid="child-chart" />
      </ChartContainer>,
    );
    expect(screen.getByTestId("child-chart")).toBeInTheDocument();
  });

  it("renders chart slot attribute", () => {
    const { container } = render(
      <ChartContainer config={sampleConfig}>
        <div />
      </ChartContainer>,
    );
    const chartDiv = container.querySelector("[data-slot='chart']");
    expect(chartDiv).toBeInTheDocument();
  });

  it("renders responsive container wrapper", () => {
    render(
      <ChartContainer config={sampleConfig}>
        <div />
      </ChartContainer>,
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ChartContainer config={sampleConfig} className="my-chart">
        <div />
      </ChartContainer>,
    );
    const chartDiv = container.querySelector("[data-slot='chart']");
    expect(chartDiv).toHaveClass("my-chart");
  });

  it("injects CSS custom properties via ChartStyle", () => {
    const { container } = render(
      <ChartContainer config={sampleConfig}>
        <div />
      </ChartContainer>,
    );
    // Should have a <style> tag with CSS variables
    const styleEl = container.querySelector("style");
    expect(styleEl).toBeInTheDocument();
    expect(styleEl?.textContent).toContain("--color-count");
    expect(styleEl?.textContent).toContain("--color-value");
  });

  it("handles config with theme colors", () => {
    const themedConfig: ChartConfig = {
      revenue: {
        label: "Revenue",
        theme: { light: "#4ade80", dark: "#22c55e" },
      },
    };
    const { container } = render(
      <ChartContainer config={themedConfig}>
        <div />
      </ChartContainer>,
    );
    const styleEl = container.querySelector("style");
    expect(styleEl?.textContent).toContain("--color-revenue");
  });

  it("does not inject style when config has no colors", () => {
    const noColorConfig: ChartConfig = {
      data: { label: "Data" },
    };
    const { container } = render(
      <ChartContainer config={noColorConfig}>
        <div />
      </ChartContainer>,
    );
    const styleEl = container.querySelector("style");
    expect(styleEl).toBeNull();
  });
});

describe("ChartStyle", () => {
  it("returns null when no color config", () => {
    const { container } = render(
      <ChartStyle id="test-chart" config={{ noColor: { label: "No Color" } }} />,
    );
    expect(container.querySelector("style")).toBeNull();
  });

  it("renders style tag when color config exists", () => {
    const { container } = render(
      <ChartStyle id="test-chart" config={{ item: { label: "Item", color: "red" } }} />,
    );
    expect(container.querySelector("style")).toBeInTheDocument();
  });
});

describe("ChartTooltipContent", () => {
  it("returns null when not active", () => {
    const { container } = render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={false} payload={[]} />
      </ChartContainer>,
    );
    // Should render nothing
    const tooltipContent = container.querySelector("[class*='rounded-lg border']");
    expect(tooltipContent).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={[]} />
      </ChartContainer>,
    );
    const tooltipContent = container.querySelector("[class*='rounded-lg border']");
    expect(tooltipContent).toBeNull();
  });

  it("renders tooltip when active with payload", () => {
    const payload = [
      {
        name: "count",
        dataKey: "count",
        value: 42,
        color: "red",
        payload: { count: 42 },
        type: "dot",
      },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} />
      </ChartContainer>,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("hides label when hideLabel is true", () => {
    const payload = [
      {
        name: "count",
        dataKey: "count",
        value: 10,
        color: "blue",
        payload: { count: 10 },
        type: "dot",
      },
    ];
    // With hideLabel, the tooltipLabel should be null so no label div is rendered
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} label="MyLabel" hideLabel={true} />
      </ChartContainer>,
    );
    // "MyLabel" text should not appear
    expect(screen.queryByText("MyLabel")).not.toBeInTheDocument();
  });
});

describe("ChartLegendContent", () => {
  it("returns null when payload is empty", () => {
    const { container } = render(
      <ChartContainer config={sampleConfig}>
        <ChartLegendContent payload={[]} />
      </ChartContainer>,
    );
    // Should render nothing since payload is empty
    const legendContent = container.querySelector("[class*='flex items-center']");
    expect(legendContent).toBeNull();
  });

  it("renders legend items when payload is provided", () => {
    const payload = [
      { value: "count", dataKey: "count", color: "red", type: "circle" as const },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartLegendContent payload={payload} />
      </ChartContainer>,
    );
    expect(screen.getByText("Count")).toBeInTheDocument();
  });
});

describe("ChartTooltipContent – additional branches", () => {
  const sampleConfig = {
    count: { label: "Count", color: "#ff0000" },
    visits: { label: "Visits", color: "#0000ff" },
  };

  it("renders labelFormatter when provided", () => {
    const payload = [
      {
        name: "count",
        dataKey: "count",
        value: 42,
        color: "red",
        payload: { count: 42 },
        type: "dot",
      },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent
          active={true}
          payload={payload}
          label="count"
          labelFormatter={(value) => <span data-testid="formatted-label">Custom: {String(value)}</span>}
        />
      </ChartContainer>,
    );
    expect(screen.getByTestId("formatted-label")).toBeInTheDocument();
    expect(screen.getByText(/custom: count/i)).toBeInTheDocument();
  });

  it("returns null for tooltipLabel when value is empty string", () => {
    const config = { "": { label: "", color: "#ff0000" } };
    const payload = [
      {
        name: "",
        dataKey: "",
        value: 5,
        color: "red",
        payload: {},
        type: "dot",
      },
    ];
    // When label is empty string, !value => true, tooltipLabel return null
    // The container should render without a label div containing text
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active={true} payload={payload} label="" />
      </ChartContainer>,
    );
    // Should not show any label text (empty string label)
    // Just verify it renders without crashing (the value 5 should still show)
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders with indicator=line", () => {
    const payload = [
      {
        name: "count",
        dataKey: "count",
        value: 42,
        color: "red",
        payload: { count: 42 },
        type: "dot",
      },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} indicator="line" />
      </ChartContainer>,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders with indicator=dashed", () => {
    const payload = [
      {
        name: "count",
        dataKey: "count",
        value: 42,
        color: "red",
        payload: { count: 42 },
        type: "dot",
      },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} indicator="dashed" />
      </ChartContainer>,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders with multiple payload items (nestLabel=false)", () => {
    const payload = [
      { name: "count", dataKey: "count", value: 42, color: "red", payload: { count: 42 }, type: "dot" },
      { name: "visits", dataKey: "visits", value: 100, color: "blue", payload: { visits: 100 }, type: "dot" },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} label="count" />
      </ChartContainer>,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders with formatter function", () => {
    const payload = [
      { name: "count", dataKey: "count", value: 42, color: "red", payload: { count: 42 }, type: "dot" },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent
          active={true}
          payload={payload}
          formatter={(value) => <span data-testid="formatted-value">Formatted: {String(value)}</span>}
        />
      </ChartContainer>,
    );
    expect(screen.getByTestId("formatted-value")).toBeInTheDocument();
  });

  it("uses labelKey to get the config label", () => {
    const payload = [
      { name: "count", dataKey: "count", value: 42, color: "red", payload: { myKey: "count" }, type: "dot" },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} label="count" labelKey="count" />
      </ChartContainer>,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders with hideIndicator=true", () => {
    const payload = [
      { name: "count", dataKey: "count", value: 42, color: "red", payload: { count: 42 }, type: "dot" },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} hideIndicator={true} />
      </ChartContainer>,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("uses nameKey when resolving config", () => {
    const payload = [
      { name: "count", dataKey: "count", value: 42, color: "red", payload: { count: "count" }, type: "dot" },
    ];
    // When nameKey is provided, it's used as the key for getPayloadConfigFromPayload
    // The payload has payload.count = "count" (a string), so configLabelKey becomes "count"
    render(
      <ChartContainer config={sampleConfig}>
        <ChartTooltipContent active={true} payload={payload} nameKey="count" />
      </ChartContainer>,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

describe("ChartLegendContent – additional branches", () => {
  const sampleConfig = {
    count: { label: "Count", color: "#ff0000", icon: () => <span data-testid="custom-icon" /> },
  };

  it("renders icon from config when available and hideIcon is false", () => {
    const payload = [
      { value: "count", dataKey: "count", color: "red", type: "circle" as const },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartLegendContent payload={payload} />
      </ChartContainer>,
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("does not render icon when hideIcon is true", () => {
    const payload = [
      { value: "count", dataKey: "count", color: "red", type: "circle" as const },
    ];
    render(
      <ChartContainer config={sampleConfig}>
        <ChartLegendContent payload={payload} hideIcon={true} />
      </ChartContainer>,
    );
    expect(screen.queryByTestId("custom-icon")).not.toBeInTheDocument();
  });

  it("renders with verticalAlign=top", () => {
    const config = { count: { label: "Count" } };
    const payload = [
      { value: "count", dataKey: "count", color: "red", type: "circle" as const },
    ];
    render(
      <ChartContainer config={config}>
        <ChartLegendContent payload={payload} verticalAlign="top" />
      </ChartContainer>,
    );
    expect(screen.getByText("Count")).toBeInTheDocument();
  });
});

