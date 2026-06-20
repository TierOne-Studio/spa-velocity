import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DialogActions } from "../DialogActions";

describe("DialogActions", () => {
  it("renders an accessible Cancel + submit footer and fires onCancel", () => {
    const onCancel = vi.fn();
    render(
      <DialogActions
        onCancel={onCancel}
        submitLabel="Save"
        pendingLabel="Saving…"
        isPending={false}
      />,
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const submit = screen.getByRole("button", { name: "Save" });
    expect(submit).toHaveAttribute("type", "submit");
    expect(cancel).toBeEnabled();
    expect(submit).toBeEnabled();

    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows the pending label and disables both buttons while pending", () => {
    render(
      <DialogActions
        onCancel={vi.fn()}
        submitLabel="Save"
        pendingLabel="Saving…"
        isPending
      />,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
