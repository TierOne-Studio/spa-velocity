import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

// OrgTargetField (ADR-011 amendment 5/6 picker) pulls in useOrgCapabilities →
// useEffectiveSession → useQuery, which needs no real QueryClient if we mock
// the capabilities hook. Default = single-org member (picker renders null), so
// the pre-existing dialog tests are unaffected; picker tests override below.
const { mockUseOrgCapabilities } = vi.hoisted(() => ({
  mockUseOrgCapabilities: vi.fn(),
}));
vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => mockUseOrgCapabilities(),
}));

function setOrgCapabilities(
  override: Partial<ReturnType<typeof buildSingleOrgCaps>> = {},
) {
  mockUseOrgCapabilities.mockReturnValue({ ...buildSingleOrgCaps(), ...override });
}
function buildSingleOrgCaps() {
  return {
    isSuperadmin: false,
    isMultiOrgMember: false,
    isSingleOrgMember: true,
    memberOrganizations: [{ id: "org-1", name: "Org One", slug: "org-1" }],
    activeOrganizationId: "org-1",
    isLoading: false,
  };
}

beforeEach(() => {
  setOrgCapabilities();
});

vi.mock("@/shared/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/shared/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div role="dialog" {...props}>
      {children}
    </div>
  ),
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props}>{children}</h3>
  ),
}));

vi.mock("@/shared/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/shared/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("../hooks/useSqlConnections", () => ({
  useCreateSqlConnection: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSqlConnection: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { SqlConnectionFormDialog } from "../SqlConnectionFormDialog";

describe("SqlConnectionFormDialog", () => {
  it("requires a successful test before create submit becomes enabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onTest = vi.fn().mockResolvedValue(undefined);

    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        onTest={onTest}
      />,
    );

    await user.type(screen.getByLabelText(/^name$/i), "Reporting DB");
    await user.type(screen.getByLabelText(/host/i), "db.example.com");
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), "5432");
    await user.type(screen.getByLabelText(/^database/i), "reporting");
    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.type(screen.getByLabelText(/password/i), "typed-secret");

    const submitButton = screen.getByTestId("sql-conn-submit");
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByTestId("sql-conn-test"));

    await waitFor(() => {
      expect(onTest).toHaveBeenCalledWith({
        host: "db.example.com",
        port: 5432,
        database: "reporting",
        username: "reader",
        password: "typed-secret",
        ssl: false,
      });
    });

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "create",
        // organizationId is null here because no defaultOrganizationId prop is
        // passed in this test; the manager falls back to its active org
        // (ADR-011 amendment 5/6). Single-org members never see the picker.
        organizationId: null,
        input: {
          name: "Reporting DB",
          host: "db.example.com",
          port: 5432,
          database: "reporting",
          username: "reader",
          password: "typed-secret",
          ssl: false,
          schemaName: "public",
        },
      });
    });
  });

  it("invalidates a successful test when a connection field changes", async () => {
    const user = userEvent.setup();
    const onTest = vi.fn().mockResolvedValue(undefined);

    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onTest={onTest}
      />,
    );

    await user.type(screen.getByLabelText(/^name$/i), "Reporting DB");
    await user.type(screen.getByLabelText(/host/i), "db.example.com");
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), "5432");
    await user.type(screen.getByLabelText(/^database/i), "reporting");
    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.type(screen.getByLabelText(/password/i), "typed-secret");

    const submitButton = screen.getByTestId("sql-conn-submit");
    await user.click(screen.getByTestId("sql-conn-test"));
    await waitFor(() => expect(submitButton).toBeEnabled());

    await user.clear(screen.getByLabelText(/host/i));
    await user.type(screen.getByLabelText(/host/i), "db-2.example.com");

    expect(submitButton).toBeDisabled();
  });

  it("reuses the stored password and preserves object SSL config when testing edit mode", async () => {
    const user = userEvent.setup();
    const onTest = vi.fn().mockResolvedValue(undefined);
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        connection={{
          id: "conn-1",
          organizationId: "org-1",
          name: "Reporting DB",
          host: "db.example.com",
          port: 5432,
          database: "reporting",
          username: "reader",
          ssl: { rejectUnauthorized: false, ca: "cert" },
          schemaName: "public",
          status: "ready",
          statusError: null,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        }}
        onSubmit={onSubmit}
        onTest={onTest}
      />,
    );

    await user.click(screen.getByTestId("sql-conn-test"));

    await waitFor(() => {
      expect(onTest).toHaveBeenCalledWith({
        connectionId: "conn-1",
        host: "db.example.com",
        port: 5432,
        database: "reporting",
        username: "reader",
        ssl: { rejectUnauthorized: false, ca: "cert" },
      });
    });

    await user.click(screen.getByTestId("sql-conn-submit"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "edit",
        connectionId: "conn-1",
        input: {
          name: "Reporting DB",
          host: "db.example.com",
          port: 5432,
          database: "reporting",
          username: "reader",
          ssl: { rejectUnauthorized: false, ca: "cert" },
          schemaName: "public",
        },
      });
    });
  });

  it("shows the backend error when connection testing fails", async () => {
    const user = userEvent.setup();
    const onTest = vi
      .fn()
      .mockRejectedValue(new Error("self-signed certificate in certificate chain"));

    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onTest={onTest}
      />,
    );

    await user.type(screen.getByLabelText(/^name$/i), "Reporting DB");
    await user.type(screen.getByLabelText(/host/i), "db.example.com");
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), "5432");
    await user.type(screen.getByLabelText(/^database/i), "reporting");
    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.type(screen.getByLabelText(/password/i), "typed-secret");

    await user.click(screen.getByTestId("sql-conn-test"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "self-signed certificate in certificate chain",
      );
    });
    expect(toast.error).toHaveBeenCalledWith(
      "self-signed certificate in certificate chain",
    );
  });

  it("shows the backend error and keeps the dialog open when submit fails", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onTest = vi.fn().mockResolvedValue(undefined);
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error("self-signed certificate in certificate chain"));

    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={onOpenChange}
        mode="create"
        onSubmit={onSubmit}
        onTest={onTest}
      />,
    );

    await user.type(screen.getByLabelText(/^name$/i), "Reporting DB");
    await user.type(screen.getByLabelText(/host/i), "db.example.com");
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), "5432");
    await user.type(screen.getByLabelText(/^database/i), "reporting");
    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.type(screen.getByLabelText(/password/i), "typed-secret");

    await user.click(screen.getByTestId("sql-conn-test"));
    await waitFor(() => expect(screen.getByTestId("sql-conn-submit")).toBeEnabled());

    await user.click(screen.getByTestId("sql-conn-submit"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "self-signed certificate in certificate chain",
      );
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.error).toHaveBeenCalledWith(
      "self-signed certificate in certificate chain",
    );
  });

  // ── ADR-011 amendment 5/6 org picker ───────────────────────────────────

  it("hides the org picker for a single-org member on create", () => {
    setOrgCapabilities(); // default = single-org member
    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={vi.fn()}
        onTest={vi.fn()}
        defaultOrganizationId="org-1"
      />,
    );
    expect(screen.queryByTestId("sql-conn-org")).toBeNull();
  });

  it("shows the org picker for a superadmin on create", () => {
    setOrgCapabilities({
      isSuperadmin: true,
      isSingleOrgMember: false,
      memberOrganizations: [],
    });
    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={vi.fn()}
        onTest={vi.fn()}
        defaultOrganizationId="org-1"
        organizations={[{ id: "org-9", name: "Any Org" }]}
      />,
    );
    expect(screen.getByTestId("sql-conn-org")).toBeInTheDocument();
  });

  it("does NOT show the org picker on EDIT mode (owning org is immutable)", () => {
    setOrgCapabilities({
      isMultiOrgMember: true,
      isSingleOrgMember: false,
      memberOrganizations: [
        { id: "org-1", name: "Org One", slug: "org-1" },
        { id: "org-2", name: "Org Two", slug: "org-2" },
      ],
    });
    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        connection={{
          id: "c1",
          name: "Existing",
          host: "h",
          port: 5432,
          database: "d",
          username: "u",
          ssl: false,
          schemaName: "public",
          status: "ready",
          statusError: null,
        } as never}
        onSubmit={vi.fn()}
        onTest={vi.fn()}
        defaultOrganizationId="org-1"
      />,
    );
    // Even for a multi-org member, edit mode hides the picker.
    expect(screen.queryByTestId("sql-conn-org")).toBeNull();
  });

  it("shows the org picker for a multi-org member and forwards the owning org in the create payload", async () => {
    setOrgCapabilities({
      isMultiOrgMember: true,
      isSingleOrgMember: false,
      memberOrganizations: [
        { id: "org-1", name: "Org One", slug: "org-1" },
        { id: "org-2", name: "Org Two", slug: "org-2" },
      ],
    });
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onTest = vi.fn().mockResolvedValue(undefined);

    render(
      <SqlConnectionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        onTest={onTest}
        defaultOrganizationId="org-2"
      />,
    );

    // Picker is visible for a multi-org member.
    expect(screen.getByTestId("sql-conn-org")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^name$/i), "Reporting DB");
    await user.type(screen.getByLabelText(/host/i), "db.example.com");
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), "5432");
    await user.type(screen.getByLabelText(/^database/i), "reporting");
    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.type(screen.getByLabelText(/password/i), "typed-secret");
    await user.click(screen.getByTestId("sql-conn-test"));
    await waitFor(() => expect(onTest).toHaveBeenCalled());

    await user.click(screen.getByTestId("sql-conn-submit"));

    // The dialog owns the org selection and forwards it (default = org-2 here,
    // the page's active org; a multi-org user could change it via the picker).
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "create", organizationId: "org-2" }),
      );
    });
  });
});