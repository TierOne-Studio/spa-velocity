import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockMutateAsync,
  mockUseReauth,
  mockOpen,
  mockUseModal,
  mockUseTheme,
} = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockUseReauth: vi.fn(),
  mockOpen: vi.fn(),
  mockUseModal: vi.fn(),
  mockUseTheme: vi.fn(),
}));

vi.mock("@/shared/components/ui/theme-provider", () => ({
  useTheme: mockUseTheme,
}));

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
  airweaveCollectionReadableId: "acme-x-deadbeef",
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
  // Default to dark for most assertions; theme-resolution tests override.
  mockUseTheme.mockReturnValue({ theme: "dark", setTheme: () => {} });
});

afterEach(() => vi.clearAllMocks());

function mockMatchMedia(matches: boolean) {
  return vi.spyOn(globalThis, "matchMedia").mockReturnValue({
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

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
      airweaveCollectionReadableId: string;
    };
    expect(passedProps.airweaveCollectionReadableId).toBe("acme-x-deadbeef");
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

// ── Theme wiring (Amendment 4 follow-up — host theme → SDK chrome) ───────

describe("ReauthSourceConnectionButton — theme wiring", () => {
  it("forwards theme: 'dark' to useAirweaveConnectModal when host theme is 'dark'", () => {
    mockUseTheme.mockReturnValue({ theme: "dark", setTheme: () => {} });
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    const passed = mockUseModal.mock.calls[0][0] as { theme?: string };
    expect(passed.theme).toBe("dark");
  });

  it("forwards theme: 'light' to useAirweaveConnectModal when host theme is 'light'", () => {
    mockUseTheme.mockReturnValue({ theme: "light", setTheme: () => {} });
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    const passed = mockUseModal.mock.calls[0][0] as { theme?: string };
    expect(passed.theme).toBe("light");
  });

  it("resolves 'system' via matchMedia(prefers-color-scheme: dark) → 'dark' when system is dark", () => {
    mockUseTheme.mockReturnValue({ theme: "system", setTheme: () => {} });
    const matchMediaSpy = mockMatchMedia(true);
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    const passed = mockUseModal.mock.calls[0][0] as { theme?: string };
    expect(passed.theme).toBe("dark");
    matchMediaSpy.mockRestore();
  });

  it("resolves 'system' to 'light' when system is NOT dark", () => {
    mockUseTheme.mockReturnValue({ theme: "system", setTheme: () => {} });
    const matchMediaSpy = mockMatchMedia(false);
    render(<ReauthSourceConnectionButton sourceConnection={oauthSource} />);
    const passed = mockUseModal.mock.calls[0][0] as { theme?: string };
    expect(passed.theme).toBe("light");
    matchMediaSpy.mockRestore();
  });
});
