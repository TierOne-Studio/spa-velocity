import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AirweaveCollectionDetail } from "@/features/Airweave/types";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockUseAirweaveCollectionDetail,
  mockCan,
  mockUseModal,
  mockOpenModal,
  mockCreateConnectSession,
  capturedModalProps,
  capturedDialogProps,
} = vi.hoisted(() => ({
  mockUseAirweaveCollectionDetail: vi.fn(),
  mockCan: vi.fn(),
  mockUseModal: vi.fn(),
  mockOpenModal: vi.fn(),
  mockCreateConnectSession: vi.fn(),
  capturedModalProps: { current: null as null | Record<string, unknown> },
  capturedDialogProps: { current: null as null | Record<string, unknown> },
}));

vi.mock("@/features/Airweave/services/source-connections.service", () => ({
  createConnectSession: mockCreateConnectSession,
}));

vi.mock(
  "@/features/Airweave/hooks/useAirweaveCollectionDetail",
  () => ({ useAirweaveCollectionDetail: mockUseAirweaveCollectionDetail }),
);

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => ({ can: mockCan }),
}));

vi.mock("@/features/Airweave/hooks/useAirweaveConnectModal", () => ({
  useAirweaveConnectModal: (opts: Record<string, unknown>) => {
    capturedModalProps.current = opts;
    return mockUseModal(opts);
  },
}));

// Stub the children that would otherwise drag in TanStack Query +
// dialog internals; they have their own tests.
vi.mock("@/features/Airweave/components/SourceConnectionsList", () => ({
  SourceConnectionsList: () => <div data-testid="stub-source-list" />,
}));
vi.mock("@/features/Airweave/components/RenameAirweaveCollectionDialog", () => ({
  RenameAirweaveCollectionDialog: () => null,
}));
vi.mock("@/features/Airweave/components/DeleteAirweaveCollectionDialog", () => ({
  DeleteAirweaveCollectionDialog: () => null,
}));
vi.mock(
  "@/features/Airweave/components/CreateSourceConnectionDialog",
  () => ({
    CreateSourceConnectionDialog: (props: Record<string, unknown>) => {
      capturedDialogProps.current = props;
      return null;
    },
  }),
);

import { AirweaveCollectionDetailPage } from "../AirweaveCollectionDetailPage";
import { AirweaveApiError } from "@/features/Airweave/lib/api-response";

function renderPage(readableId = "acme-x-deadbeef") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/admin/airweave/${readableId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/admin/airweave/:airweaveCollectionReadableId"
            element={children}
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return render(<AirweaveCollectionDetailPage />, { wrapper: Wrapper });
}

const detail: AirweaveCollectionDetail = {
  id: "uuid-1",
  name: "Knowledge Base",
  readableId: "acme-x-deadbeef",
  organizationId: "org-1",
  createdAt: "",
  updatedAt: "",
  status: "active",
  sourceConnectionCount: 0,
  vectorSize: 1536,
  embeddingModelName: "text-embedding-3-large",
};

beforeEach(() => {
  vi.clearAllMocks();
  capturedModalProps.current = null;
  capturedDialogProps.current = null;
  mockOpenModal.mockReset();
  mockCreateConnectSession.mockReset();
  mockCreateConnectSession.mockResolvedValue({ sessionToken: "tok-from-backend" });
  mockUseModal.mockReturnValue({ open: mockOpenModal, isLoading: false });
  mockCan.mockReturnValue(true);
  mockUseAirweaveCollectionDetail.mockReturnValue({
    data: detail,
    isLoading: false,
    isError: false,
    error: null,
  });
});

afterEach(() => vi.clearAllMocks());

describe("AirweaveCollectionDetailPage — catalog-widget flow (ADR-011 Amendment 4)", () => {
  it("getSessionToken fetches a fresh token from POST /api/airweave/connect/session each call", async () => {
    renderPage();
    const modalProps = capturedModalProps.current as {
      getSessionToken: () => Promise<string>;
    };

    await expect(modalProps.getSessionToken()).resolves.toBe(
      "tok-from-backend",
    );
    expect(mockCreateConnectSession).toHaveBeenCalledWith("acme-x-deadbeef");

    // Second call hits the backend AGAIN — no per-page caching, the
    // widget always gets a fresh-issued token.
    mockCreateConnectSession.mockResolvedValueOnce({
      sessionToken: "tok-second",
    });
    await expect(modalProps.getSessionToken()).resolves.toBe("tok-second");
    expect(mockCreateConnectSession).toHaveBeenCalledTimes(2);
  });

  it("getSessionToken surfaces backend failures verbatim (no silent fallback)", async () => {
    renderPage();
    const modalProps = capturedModalProps.current as {
      getSessionToken: () => Promise<string>;
    };
    mockCreateConnectSession.mockRejectedValueOnce(
      new Error("Failed to create connect session for 'acme-x-deadbeef'"),
    );
    await expect(modalProps.getSessionToken()).rejects.toThrow(
      /Failed to create connect session/,
    );
  });

  it("after unmount, getSessionToken fails fast with 'Page unmounted' and does NOT hit the backend (orphan session prevention)", async () => {
    const { unmount } = renderPage();
    const modalProps = capturedModalProps.current as {
      getSessionToken: () => Promise<string>;
    };
    unmount();
    await expect(modalProps.getSessionToken()).rejects.toThrow(
      /Page unmounted/,
    );
    // Critical: do NOT issue an Airweave session for an unmounted page.
    expect(mockCreateConnectSession).not.toHaveBeenCalled();
  });

  it("after unmount, onConnected callback is a no-op (mountedRef guard prevents setState-after-unmount)", () => {
    const { unmount } = renderPage();
    const modalProps = capturedModalProps.current as {
      onConnected: () => void;
    };
    unmount();
    // No React warning, no throw — guard short-circuits cleanly.
    expect(() => modalProps.onConnected()).not.toThrow();
  });

  it("after unmount, onCancelled callback is a no-op (mountedRef guard)", () => {
    const { unmount } = renderPage();
    const modalProps = capturedModalProps.current as {
      onCancelled: () => void;
    };
    unmount();
    expect(() => modalProps.onCancelled()).not.toThrow();
  });

  it("dialog mounts WITHOUT onOAuthSubmit prop (ADR-011 § Amendment 4: OAuth no longer routes through this dialog)", () => {
    renderPage();
    const dialogProps = capturedDialogProps.current as Record<string, unknown>;
    expect(dialogProps).not.toHaveProperty("onOAuthSubmit");
    // The dialog still owns the direct-auth path; it gets the
    // standard open/onOpenChange/airweaveCollectionReadableId trio.
    expect(dialogProps).toHaveProperty("airweaveCollectionReadableId");
    expect(dialogProps).toHaveProperty("open");
    expect(dialogProps).toHaveProperty("onOpenChange");
  });

  it("page renders SourceConnectionsList + collection name when not loading", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /knowledge base/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("stub-source-list")).toBeInTheDocument();
  });

  it("notFound state (404) renders the friendly empty card", () => {
    mockUseAirweaveCollectionDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new AirweaveApiError("not found", 404, {}),
    });
    renderPage("missing-id");
    expect(screen.getByText(/doesn't exist or isn't owned/i)).toBeInTheDocument();
  });
});
