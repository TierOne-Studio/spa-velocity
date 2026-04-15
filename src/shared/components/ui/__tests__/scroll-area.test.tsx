import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock radix scroll area
vi.mock("@radix-ui/react-scroll-area", () => ({
  Root: ({ children, className, ...props }: { children: ReactNode; className?: string; [key: string]: unknown }) => (
    <div className={className} data-testid="scroll-root" {...props}>{children}</div>
  ),
  Viewport: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className} data-testid="scroll-viewport">{children}</div>
  ),
  ScrollAreaScrollbar: ({ children, orientation, className }: {
    children?: ReactNode;
    orientation?: string;
    className?: string;
    ref?: unknown;
  }) => <div data-orientation={orientation} className={className}>{children}</div>,
  ScrollAreaThumb: ({ className }: { className?: string }) => <div className={className} data-testid="scroll-thumb" />,
  Corner: () => null,
}));

import { ScrollArea, ScrollBar } from "../scroll-area";

describe("ScrollArea", () => {
  it("renders children inside scroll area", () => {
    const { getByText } = render(
      <ScrollArea>
        <div>Scroll content</div>
      </ScrollArea>,
    );
    expect(getByText("Scroll content")).toBeInTheDocument();
  });

  it("applies custom className to root", () => {
    const { getByTestId } = render(
      <ScrollArea className="custom-scroll">
        <div />
      </ScrollArea>,
    );
    expect(getByTestId("scroll-root")).toHaveClass("custom-scroll");
  });
});

describe("ScrollBar", () => {
  it("renders with default vertical orientation", () => {
    const { container } = render(<ScrollBar />);
    // Default orientation is "vertical"
    const scrollbar = container.querySelector("[data-orientation]");
    expect(scrollbar?.getAttribute("data-orientation")).toBe("vertical");
  });

  it("renders with horizontal orientation (covers line 34 branch)", () => {
    // Covers line 34: orientation === "horizontal" && "h-2.5 flex-col border-t..."
    const { container } = render(<ScrollBar orientation="horizontal" />);
    const scrollbar = container.querySelector("[data-orientation]");
    expect(scrollbar?.getAttribute("data-orientation")).toBe("horizontal");
    // The horizontal class should be applied
    expect(scrollbar?.className).toContain("h-2.5");
  });
});
