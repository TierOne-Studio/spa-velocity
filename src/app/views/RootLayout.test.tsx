import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/shared/components/ui/app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock("@/shared/components/ui/site-header", () => ({
  SiteHeader: () => <div data-testid="site-header" />,
}));

vi.mock("@/shared/components/ImpersonationBanner", () => ({
  ImpersonationBanner: () => <div data-testid="impersonation-banner" />,
}));

import RootLayout from "./RootLayout";

const mountSpy = vi.fn();
const unmountSpy = vi.fn();

function TrackedPage({
  label,
  nextPath,
}: {
  label: string;
  nextPath?: string;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    mountSpy(label);

    return () => {
      unmountSpy(label);
    };
  }, [label]);

  return (
    <div>
      <div>{label}</div>
      {nextPath ? <button onClick={() => navigate(nextPath)}>Go to next page</button> : null}
    </div>
  );
}

describe("RootLayout", () => {
  it("remounts the outlet subtree when the pathname changes", async () => {
    mountSpy.mockClear();
    unmountSpy.mockClear();

    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <RootLayout />,
          children: [
            {
              path: "admin/roles",
              element: <TrackedPage label="Roles page" nextPath="/admin/users" />,
            },
            {
              path: "admin/users",
              element: <TrackedPage label="Users page" />,
            },
          ],
        },
      ],
      {
        initialEntries: ["/admin/roles"],
      },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("Roles page")).toBeInTheDocument();
    expect(mountSpy).toHaveBeenCalledWith("Roles page");

    await user.click(screen.getByRole("button", { name: /go to next page/i }));

    expect(await screen.findByText("Users page")).toBeInTheDocument();
    expect(unmountSpy).toHaveBeenCalledWith("Roles page");
    expect(mountSpy).toHaveBeenCalledWith("Users page");
  });
});
