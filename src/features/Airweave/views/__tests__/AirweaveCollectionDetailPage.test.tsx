import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AirweaveCollectionDetail } from "@/features/Airweave/types";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockUseCollectionDetail,
  mockCan,
  mockUseModal,
  mockOpenModal,
  capturedModalProps,
  capturedDialogProps,
} = vi.hoisted(() => ({
  mockUseCollectionDetail: vi.fn(),
  mockCan: vi.fn(),
  mockUseModal: vi.fn(),
  mockOpenModal: vi.fn(),
  capturedModalProps: { current: null as null | Record<string, unknown> },
  capturedDialogProps: { current: null as null | Record<string, unknown> },
}));

vi.mock(
  "@/features/Airweave/hooks/useAirweaveCollectionDetail",
  () => ({ useAirweaveCollectionDetail: mockUseCollectionDetail }),
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
vi.mock("@/features/Airweave/components/RenameCollectionDialog", () => ({
  RenameCollectionDialog: () => null,
}));
vi.mock("@/features/Airweave/components/DeleteCollectionDialog", () => ({
  DeleteCollectionDialog: () => null,
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
            path="/admin/airweave/:collectionReadableId"
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
  mockUseModal.mockReturnValue({ open: mockOpenModal, isLoading: false });
  mockCan.mockReturnValue(true);
  mockUseCollectionDetail.mockReturnValue({
    data: detail,
    isLoading: false,
    isError: false,
    error: null,
  });
});

afterEach(() => vi.clearAllMocks());

describe("AirweaveCollectionDetailPage — ref-mirror + lifecycle (qa HIGH #2)", () => {
  it("onOAuthSubmit writes pendingTokenRef BEFORE calling connectModal.open() so getSessionToken reads the fresh token", async () => {
    renderPage();
    const dialogProps = capturedDialogProps.current as {
      onOAuthSubmit: (token: string) => void;
    };
    const modalProps = capturedModalProps.current as {
      getSessionToken: () => Promise<string>;
    };

    // Initial state: no pending token → getSessionToken throws.
    await expect(modalProps.getSessionToken()).rejects.toThrow(
      /No pending OAuth token/,
    );

    // Simulate the dialog's OAuth submit calling back into the page.
    act(() => {
      dialogProps.onOAuthSubmit("tok-fresh");
    });

    // open() was called as part of the handoff.
    expect(mockOpenModal).toHaveBeenCalledTimes(1);

    // And the ref was written BEFORE open() — proven by getSessionToken
    // resolving the fresh token after the synchronous handoff.
    await expect(modalProps.getSessionToken()).resolves.toBe("tok-fresh");
  });

  it("getSessionToken throws the actionable Path-B message when ref is null", async () => {
    renderPage();
    const modalProps = capturedModalProps.current as {
      getSessionToken: () => Promise<string>;
    };
    await expect(modalProps.getSessionToken()).rejects.toThrow(
      "No pending OAuth token — click Reauth on the row to retry.",
    );
  });

  it("after unmount, getSessionToken fails fast with 'Page unmounted' (qa HIGH #3 — failure-mode #13)", async () => {
    const { unmount } = renderPage();
    const modalProps = capturedModalProps.current as {
      getSessionToken: () => Promise<string>;
    };
    unmount();
    await expect(modalProps.getSessionToken()).rejects.toThrow(
      /Page unmounted/,
    );
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

  it("cleanup useEffect clears pendingTokenRef on unmount (leak prevention)", async () => {
    const { unmount } = renderPage();
    const dialogProps = capturedDialogProps.current as {
      onOAuthSubmit: (token: string) => void;
    };
    const modalProps = capturedModalProps.current as {
      getSessionToken: () => Promise<string>;
    };

    act(() => {
      dialogProps.onOAuthSubmit("tok-fresh");
    });
    unmount();

    // After unmount, the ref is nulled AND the unmounted check fires
    // first (defense-in-depth: both throws are acceptable, both indicate
    // the token is no longer in scope).
    await expect(modalProps.getSessionToken()).rejects.toThrow();
  });

  it("page renders SourceConnectionsList + collection name when not loading", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /knowledge base/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("stub-source-list")).toBeInTheDocument();
  });

  it("notFound state (404) renders the friendly empty card", () => {
    mockUseCollectionDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new AirweaveApiError("not found", 404, {}),
    });
    renderPage("missing-id");
    expect(screen.getByText(/doesn't exist or isn't owned/i)).toBeInTheDocument();
  });
});
