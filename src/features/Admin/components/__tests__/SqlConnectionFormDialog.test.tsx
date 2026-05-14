import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

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
});