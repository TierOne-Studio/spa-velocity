import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SystemViewBanner } from "../SystemViewBanner";

describe("SystemViewBanner", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<SystemViewBanner visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the default message when visible", () => {
    render(<SystemViewBanner visible={true} />);

    const banner = screen.getByTestId("system-view-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveTextContent(
      /System view: showing data across all organizations\./,
    );
  });

  it("honors a custom message", () => {
    render(<SystemViewBanner visible={true} message="Cross-tenant view active" />);
    expect(screen.getByText("Cross-tenant view active")).toBeInTheDocument();
  });

  it("honors a custom testId", () => {
    render(<SystemViewBanner visible={true} testId="sys-banner" />);
    expect(screen.getByTestId("sys-banner")).toBeInTheDocument();
  });

  it("applies extra class names", () => {
    render(<SystemViewBanner visible={true} className="mt-2" />);
    expect(screen.getByTestId("system-view-banner")).toHaveClass("mt-2");
  });
});
