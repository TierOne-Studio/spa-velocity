import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group";

describe("ToggleGroup", () => {
  it("renders group with items", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
        <ToggleGroupItem value="c">C</ToggleGroupItem>
      </ToggleGroup>,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("renders items as radio buttons in single mode", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="x">X</ToggleGroupItem>
      </ToggleGroup>,
    );
    expect(screen.getByRole("radio", { name: "X" })).toBeInTheDocument();
  });

  it("selects item in single mode when clicked", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="one">One</ToggleGroupItem>
        <ToggleGroupItem value="two">Two</ToggleGroupItem>
      </ToggleGroup>,
    );
    const oneBtn = screen.getByRole("radio", { name: "One" });
    fireEvent.click(oneBtn);
    expect(oneBtn).toHaveAttribute("data-state", "on");

    const twoBtn = screen.getByRole("radio", { name: "Two" });
    fireEvent.click(twoBtn);
    expect(twoBtn).toHaveAttribute("data-state", "on");
    expect(oneBtn).toHaveAttribute("data-state", "off");
  });

  it("supports multiple selection in multiple mode", () => {
    render(
      <ToggleGroup type="multiple">
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
        <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      </ToggleGroup>,
    );
    // In multiple mode, items may render as toggle buttons (no radio)
    const boldBtn = screen.getByText("Bold").closest("button")!;
    const italicBtn = screen.getByText("Italic").closest("button")!;

    fireEvent.click(boldBtn);
    fireEvent.click(italicBtn);

    expect(boldBtn).toHaveAttribute("data-state", "on");
    expect(italicBtn).toHaveAttribute("data-state", "on");
  });

  it("calls onValueChange with selected value (single)", () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup type="single" onValueChange={onChange}>
        <ToggleGroupItem value="7d">7d</ToggleGroupItem>
        <ToggleGroupItem value="30d">30d</ToggleGroupItem>
      </ToggleGroup>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "30d" }));
    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("reflects controlled value", () => {
    render(
      <ToggleGroup type="single" value="active">
        <ToggleGroupItem value="active">Active</ToggleGroupItem>
        <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
      </ToggleGroup>,
    );
    expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("radio", { name: "Inactive" })).toHaveAttribute("data-state", "off");
  });

  it("applies group data attributes", () => {
    const { container } = render(
      <ToggleGroup type="single" variant="outline" size="sm">
        <ToggleGroupItem value="x">X</ToggleGroupItem>
      </ToggleGroup>,
    );
    const group = container.querySelector("[data-slot='toggle-group']");
    expect(group).toBeInTheDocument();
  });

  it("items inherit variant from group context (outline adds border)", () => {
    render(
      <ToggleGroup type="single" variant="outline">
        <ToggleGroupItem value="item">Item</ToggleGroupItem>
      </ToggleGroup>,
    );
    const item = screen.getByRole("radio", { name: "Item" });
    expect(item.className).toContain("border");
  });

  it("disabled items cannot be clicked", () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup type="single" onValueChange={onChange}>
        <ToggleGroupItem value="disabled" disabled>Disabled</ToggleGroupItem>
      </ToggleGroup>,
    );
    const btn = screen.getByRole("radio", { name: "Disabled" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies item-level data-slot attribute", () => {
    const { container } = render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="test">Test</ToggleGroupItem>
      </ToggleGroup>,
    );
    const item = container.querySelector("[data-slot='toggle-group-item']");
    expect(item).toBeInTheDocument();
  });
});
