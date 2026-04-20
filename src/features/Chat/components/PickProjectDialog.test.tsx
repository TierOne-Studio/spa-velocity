import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { mockUseProjects } = vi.hoisted(() => ({
  mockUseProjects: vi.fn(),
}));

vi.mock("@/features/Projects/hooks/useProjects", () => ({
  useProjects: (options?: unknown) => mockUseProjects(options),
}));

import { PickProjectDialog } from "./PickProjectDialog";

const projects = [
  {
    id: "p-1",
    name: "Alpha",
    organizationId: "org-1",
    description: null,
    sourceCount: 1,
    conversationCount: 2,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "p-2",
    name: "Beta",
    organizationId: "org-1",
    description: null,
    sourceCount: 0,
    conversationCount: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseProjects.mockReturnValue({ data: projects, isLoading: false, error: null });
});

function renderDialog(props: Partial<React.ComponentProps<typeof PickProjectDialog>> = {}) {
  return render(
    <MemoryRouter>
      <PickProjectDialog
        open
        onOpenChange={vi.fn()}
        organizationId="org-1"
        onSelect={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("PickProjectDialog", () => {
  it("renders default title when currentProjectId is not provided", () => {
    renderDialog();
    expect(screen.getByText("Pick a project")).toBeInTheDocument();
    expect(
      screen.getByText(/Chats belong to a project\. Pick one/i),
    ).toBeInTheDocument();
  });

  it("renders switch-mode title and description when currentProjectId is provided", () => {
    renderDialog({ currentProjectId: "p-1" });
    expect(screen.getByText("Switch project")).toBeInTheDocument();
    expect(
      screen.getByText(/Picking a different project starts a new chat/i),
    ).toBeInTheDocument();
  });

  it("shows a Current badge on the current project row", () => {
    renderDialog({ currentProjectId: "p-1" });
    expect(screen.getByTestId("pick-project-current-p-1")).toBeInTheDocument();
    expect(screen.queryByTestId("pick-project-current-p-2")).not.toBeInTheDocument();
  });

  it("disables the current project button and does not call onSelect when clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderDialog({ currentProjectId: "p-1", onSelect });
    const currentButton = screen.getByTestId("pick-project-option-p-1");
    expect(currentButton).toBeDisabled();
    await user.click(currentButton);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSelect with the chosen project id when a different row is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderDialog({ currentProjectId: "p-1", onSelect });
    await user.click(screen.getByTestId("pick-project-option-p-2"));
    expect(onSelect).toHaveBeenCalledWith("p-2");
  });
});
