import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockMutateAsync, mockUseReauth, mockOpen, mockUseModal } = vi.hoisted(
  () => ({
    mockMutateAsync: vi.fn(),
    mockUseReauth: vi.fn(),
    mockOpen: vi.fn(),
    mockUseModal: vi.fn(),
  }),
);

vi.mock(
  "@/features/Airweave/hooks/useReauthAirweaveSourceConnection",
  () => ({
    useReauthAirweaveSourceConnection: mockUseReauth,
  }),
);

vi.mock("@/features/Airweave/hooks/useAirweaveConnectModal", () => ({
  useAirweaveConnectModal: mockUseModal,
}));

// Stub Radix DropdownMenu so the test can render the item without a
// parent DropdownMenu provider context (the real component will be
// exercised by the parent SourceConnectionsList integration).
vi.mock("@/shared/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
    ...rest
  }: {
    children: ReactNode;
    onSelect?: (event: Event) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => onSelect?.(e as unknown as Event)}
      {...rest}
    >
      {children}
    </button>
  ),
}));

import { ReauthSourceConnectionButton } from "../ReauthSourceConnectionButton";

const oauthSource: AirweaveSourceConnection = {
  id: "src-1",
  name: "Acme Slack",
  shortName: "slack",
  collectionReadableId: "acme-x-deadbeef",
  createdAt: "2026-05-25T00:00:00.000Z",
  updatedAt: "2026-05-25T00:00:00.000Z",
  isAuthenticated: true,
  entityCount: 0,
  authMethod: "oauth_browser",
  status: "active",
};

const directSource: AirweaveSourceConnection = {
  ...oauthSource,
  id: "src-2",
  authMethod: "direct",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({ sessionToken: "tok-fresh" });
  mockUseReauth.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
  mockUseModal.mockReturnValue({ open: mockOpen, isLoading: false });
});

afterEach(() => vi.clearAllMocks());

describe("ReauthSourceConnectionButton", () => {
  it("renders null when authMethod !== 'oauth_browser' (defense-in-depth visibility filter)", () => {
    const { container } = render(
      <ReauthSourceConnectionButton sourceConnection={directSource} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the menu item when authMethod === 'oauth_browser'", () => {
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    expect(
      screen.getByRole("button", { name: /re-authenticate/i }),
    ).toBeInTheDocument();
  });

  it("on click: calls preventDefault then connectModal.open()", () => {
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    fireEvent.click(screen.getByRole("button", { name: /re-authenticate/i }));
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("getSessionToken (passed to wrapper) resolves to the reauth mutation's sessionToken", async () => {
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    // The wrapper was called with the source-bound getSessionToken; invoke
    // it to prove the round-trip.
    const passedProps = mockUseModal.mock.calls[0][0] as {
      getSessionToken: () => Promise<string>;
      collectionReadableId: string;
    };
    expect(passedProps.collectionReadableId).toBe("acme-x-deadbeef");
    await expect(passedProps.getSessionToken()).resolves.toBe("tok-fresh");
    expect(mockMutateAsync).toHaveBeenCalledWith("src-1");
  });

  it("button is disabled while reauthMutation.isPending (failure-mode #8: double-click race)", () => {
    mockUseReauth.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    expect(screen.getByRole("button", { name: /re-authenticate/i })).toBeDisabled();
  });

  it("button is disabled while connectModal.isLoading (failure-mode #8: double-click race)", () => {
    mockUseModal.mockReturnValue({ open: mockOpen, isLoading: true });
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    expect(screen.getByRole("button", { name: /re-authenticate/i })).toBeDisabled();
  });

  it("each click fires a fresh getSessionToken call (failure-mode #12: reauth reopen → fresh token)", async () => {
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    const passedProps = mockUseModal.mock.calls[0][0] as {
      getSessionToken: () => Promise<string>;
    };
    await passedProps.getSessionToken();
    await passedProps.getSessionToken();
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, "src-1");
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, "src-1");
  });
});
