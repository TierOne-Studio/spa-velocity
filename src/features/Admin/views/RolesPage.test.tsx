import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  mockUseRoles,
  mockUsePermissionsGrouped,
  mockUseCreateRole,
  mockUseUpdateRole,
  mockUseDeleteRole,
  mockUseAssignPermissions,
  mockCan,
  mockUseAuth,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseRoles: vi.fn(),
  mockUsePermissionsGrouped: vi.fn(),
  mockUseCreateRole: vi.fn(),
  mockUseUpdateRole: vi.fn(),
  mockUseDeleteRole: vi.fn(),
  mockUseAssignPermissions: vi.fn(),
  mockCan: vi.fn(),
  mockUseAuth: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("../hooks/useRoles", () => ({
  useRoles: () => mockUseRoles(),
  usePermissionsGrouped: () => mockUsePermissionsGrouped(),
  useCreateRole: () => mockUseCreateRole(),
  useUpdateRole: () => mockUseUpdateRole(),
  useDeleteRole: () => mockUseDeleteRole(),
  useAssignPermissions: () => mockUseAssignPermissions(),
}));

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => ({ can: mockCan }),
}));

vi.mock("@/shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@tabler/icons-react", () => ({
  IconPlus: () => <span aria-hidden="true">plus</span>,
  IconEdit: () => <span aria-hidden="true">edit</span>,
  IconTrash: () => <span aria-hidden="true">trash</span>,
  IconShield: () => <span aria-hidden="true">shield</span>,
}));

vi.mock("@/shared/components/ui/card", () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock("@/shared/components/ui/badge", () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock("@/shared/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("@/shared/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/shared/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock("@/shared/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void } & InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

vi.mock("@/shared/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => <>{open ? children : null}</>,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div role="dialog" {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}));

vi.mock("@/shared/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

import { RolesPage } from "./RolesPage";

describe("RolesPage", () => {
  const createRoleMutation = {
    mutateAsync: vi.fn(),
    isPending: false,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRoles.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockUsePermissionsGrouped.mockReturnValue({ data: {} });
    mockUseCreateRole.mockReturnValue(createRoleMutation);
    mockUseUpdateRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDeleteRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseAssignPermissions.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockCan.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      user: { role: "member" },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { permissions: [] } }),
      }),
    );
  });

  it("shows the create button and all roles when role:create is granted", async () => {
    mockUseRoles.mockReturnValue({
      data: [
        { id: "role-1", name: "admin", displayName: "Admin", description: "Admin role", color: "red", isSystem: true },
        { id: "role-2", name: "member", displayName: "Member", description: "Member role", color: "gray", isSystem: true },
      ],
      isLoading: false,
    });
    mockCan.mockImplementation((resource: string, action: string) => resource === "role" && action === "create");
    mockUseAuth.mockReturnValue({
      user: { role: "admin" },
    });

    render(<RolesPage />);

    expect(screen.getByRole("button", { name: /create role/i })).toBeVisible();
    expect(screen.getByTestId("role-card-admin")).toBeVisible();
    expect(screen.getByTestId("role-card-member")).toBeVisible();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("submits role creation when role:create is granted", async () => {
    createRoleMutation.mutateAsync.mockResolvedValue({
      id: "role-3",
      name: "editor",
      displayName: "Editor",
      color: "gray",
    });
    mockCan.mockImplementation((resource: string, action: string) => resource === "role" && action === "create");
    mockUseAuth.mockReturnValue({
      user: { role: "admin" },
    });

    render(<RolesPage />);

    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    fireEvent.change(screen.getByLabelText(/name \(identifier\)/i), { target: { value: "editor" } });
    fireEvent.change(screen.getByLabelText(/^display name$/i), { target: { value: "Editor" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(createRoleMutation.mutateAsync).toHaveBeenCalledWith({
        name: "editor",
        displayName: "Editor",
        description: undefined,
        color: "gray",
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Role created successfully");
  });
});
