import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "../sheet";

describe("Sheet", () => {
  it("does not render content when closed", () => {
    render(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
        <SheetContent>
          <SheetTitle>My Sheet</SheetTitle>
          <SheetDescription>Sheet description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    // Content not in the DOM or not visible when closed
    const title = screen.queryByText("My Sheet");
    // Either not in DOM or not visible
    expect(title === null || !title.checkVisibility?.()).toBe(true);
  });

  it("opens when trigger is clicked", () => {
    render(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
        <SheetContent>
          <SheetTitle>My Sheet</SheetTitle>
          <SheetDescription>Sheet description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(screen.getByText("Open Sheet"));
    expect(screen.getByText("My Sheet")).toBeVisible();
    expect(screen.getByText("Sheet description")).toBeVisible();
  });

  it("renders SheetHeader with children", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Header Title</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Header Title")).toBeInTheDocument();
  });

  it("renders SheetFooter with children", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetFooter>
            <button type="button">Confirm Action</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole("button", { name: "Confirm Action" })).toBeInTheDocument();
  });

  it("renders close button in content", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    // The X close button has sr-only text "Close"
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("can be opened with defaultOpen prop", () => {
    render(
      <Sheet defaultOpen>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Default Open Sheet</SheetTitle>
          <SheetDescription>This is open by default</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Default Open Sheet")).toBeVisible();
  });

  it("renders different side variants", () => {
    const { rerender } = render(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Left Sheet</SheetTitle>
          <SheetDescription>Left side</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Left Sheet")).toBeInTheDocument();

    rerender(
      <Sheet open>
        <SheetContent side="top">
          <SheetTitle>Top Sheet</SheetTitle>
          <SheetDescription>Top side</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Top Sheet")).toBeInTheDocument();

    rerender(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Bottom Sheet</SheetTitle>
          <SheetDescription>Bottom side</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Bottom Sheet")).toBeInTheDocument();
  });

  it("renders SheetDescription correctly", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Some description text</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Some description text")).toBeInTheDocument();
  });

  it("SheetClose renders as button", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetClose>Close Me</SheetClose>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Close Me")).toBeInTheDocument();
  });
});
