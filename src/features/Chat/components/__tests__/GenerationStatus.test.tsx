import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { GenerationStatus } from "../GenerationStatus";

describe("GenerationStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when stage is idle", () => {
    const { container } = render(<GenerationStatus stage="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders thinking stage", () => {
    render(<GenerationStatus stage="thinking" />);
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
  });

  it("renders searching stage without query", () => {
    render(<GenerationStatus stage="searching" />);
    expect(screen.getByText(/Searching/)).toBeInTheDocument();
  });

  it("renders searching stage with query", () => {
    render(<GenerationStatus stage="searching" searchQuery="What is React?" />);
    expect(screen.getByText(/Searching: What is React\?/)).toBeInTheDocument();
  });

  it("renders responding stage", () => {
    render(<GenerationStatus stage="responding" />);
    expect(screen.getByText(/Responding/)).toBeInTheDocument();
  });

  it("animates dots for thinking stage", () => {
    render(<GenerationStatus stage="thinking" />);
    expect(screen.getByText("Thinking")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Thinking.")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Thinking..")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Thinking...")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Thinking")).toBeInTheDocument(); // resets
  });

  it("animates dots for searching stage", () => {
    render(<GenerationStatus stage="searching" />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Searching.")).toBeInTheDocument();
  });

  it("animates dots for responding stage", () => {
    render(<GenerationStatus stage="responding" />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Responding.")).toBeInTheDocument();
  });

  it("does not animate when stage is idle (no interval)", () => {
    render(<GenerationStatus stage="idle" />);
    act(() => { vi.advanceTimersByTime(2000); });
    // Still null
    expect(screen.queryByText(/Thinking|Searching|Responding/)).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<GenerationStatus stage="thinking" className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("stops interval when stage changes to idle", () => {
    const { rerender } = render(<GenerationStatus stage="thinking" />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Thinking.")).toBeInTheDocument();

    rerender(<GenerationStatus stage="idle" />);
    expect(screen.queryByText(/Thinking/)).not.toBeInTheDocument();
  });
});
