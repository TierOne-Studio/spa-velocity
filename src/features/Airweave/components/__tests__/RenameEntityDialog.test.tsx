import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockSuccess, mockError } = vi.hoisted(() => ({
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: mockSuccess, error: mockError },
}));

import { RenameEntityDialog } from "../RenameEntityDialog";

function renderDialog(
  overrides: Partial<Parameters<typeof RenameEntityDialog>[0]> = {},
) {
  const onOpenChange = vi.fn();
  const onRename = vi.fn().mockResolvedValue(undefined);
  render(
    <RenameEntityDialog
      open
      onOpenChange={onOpenChange}
      title="Rename Thing"
      description="A description."
      fieldId="rename-name"
      currentName="Old Name"
      successMessage="Renamed."
      fallbackError="Failed to rename"
      onRename={onRename}
      {...overrides}
    />,
  );
  return { onOpenChange, onRename };
}

describe("RenameEntityDialog", () => {
  beforeEach(() => {
    mockSuccess.mockReset();
    mockError.mockReset();
  });

  it("renames with the trimmed value, toasts success, and closes", async () => {
    const { onOpenChange, onRename } = renderDialog();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  New Name  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith("New Name"));
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith("Renamed."));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("skips the mutation and just closes when the name is unchanged", async () => {
    const { onOpenChange, onRename } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onRename).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it("toasts the backend error message when the mutation rejects", async () => {
    const onRename = vi.fn().mockRejectedValue(new Error("boom"));
    renderDialog({ onRename });

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockError).toHaveBeenCalledWith("boom"));
  });

  it("blocks submit and shows a validation error when the name is empty", async () => {
    const { onRename } = renderDialog();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Name is required")).toBeInTheDocument(),
    );
    expect(onRename).not.toHaveBeenCalled();
  });
});
