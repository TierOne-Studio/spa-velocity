import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toggle } from "../toggle";

describe("Toggle", () => {
  it("renders children correctly", () => {
    render(<Toggle>Bold</Toggle>);
    expect(screen.getByText("Bold")).toBeInTheDocument();
  });

  it("renders as a button element", () => {
    render(<Toggle>Click me</Toggle>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("toggles on/off when clicked", () => {
    render(<Toggle>Toggle</Toggle>);
    const button = screen.getByRole("button");
    // initial state: off (data-state="off")
    expect(button).toHaveAttribute("data-state", "off");
    fireEvent.click(button);
    expect(button).toHaveAttribute("data-state", "on");
    fireEvent.click(button);
    expect(button).toHaveAttribute("data-state", "off");
  });

  it("renders in pressed state when defaultPressed is true", () => {
    render(<Toggle defaultPressed>Pressed</Toggle>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-state", "on");
  });

  it("applies default variant classes", () => {
    render(<Toggle>Default</Toggle>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-slot", "toggle");
  });

  it("applies outline variant classes", () => {
    render(<Toggle variant="outline">Outline</Toggle>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("border");
  });

  it("applies sm size", () => {
    render(<Toggle size="sm">Small</Toggle>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("h-8");
  });

  it("applies lg size", () => {
    render(<Toggle size="lg">Large</Toggle>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("h-10");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Toggle disabled>Disabled</Toggle>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("calls onPressedChange when clicked", () => {
    const onChange = vi.fn();
    render(<Toggle onPressedChange={onChange}>Callable</Toggle>);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("applies custom className", () => {
    render(<Toggle className="my-custom-class">Custom</Toggle>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("my-custom-class");
  });
});
