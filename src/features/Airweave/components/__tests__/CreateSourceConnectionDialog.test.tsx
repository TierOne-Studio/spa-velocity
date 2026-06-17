import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createContext, useContext, useState, type ReactNode } from "react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockMutateAsync, mockUseCreate, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockMutateAsync: vi.fn(),
    mockUseCreate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock(
  "@/features/Airweave/hooks/useCreateAirweaveSourceConnection",
  () => ({
    useCreateAirweaveSourceConnection: mockUseCreate,
  }),
);

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

// Stub Radix Tabs — only one TabsContent renders at a time (avoids
// duplicate-label clashes between Direct + OAuth panels). Uses real
// React context + useState so clicking TabsTrigger triggers a re-render
// and the active panel swaps cleanly.
const TabsCtx = createContext<{
  active: string;
  setActive: (v: string) => void;
}>({ active: "direct", setActive: () => {} });

vi.mock("@/shared/components/ui/tabs", () => ({
  Tabs: ({
    children,
    defaultValue,
  }: {
    children: ReactNode;
    defaultValue: string;
  }) => {
    const [active, setActive] = useState(defaultValue);
    return (
      <TabsCtx.Provider value={{ active, setActive }}>
        <div data-testid="tabs">{children}</div>
      </TabsCtx.Provider>
    );
  },
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => {
    const { setActive } = useContext(TabsCtx);
    return (
      <button type="button" onClick={() => setActive(value)}>
        {children}
      </button>
    );
  },
  TabsContent: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => {
    const { active } = useContext(TabsCtx);
    return value === active ? <div>{children}</div> : null;
  },
}));

// Stub Radix Dialog — render children inline whenever open is true.
vi.mock("@/shared/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { CreateSourceConnectionDialog } from "../CreateSourceConnectionDialog";

function renderDialog(overrides: Partial<{
  onOpenChange: (open: boolean) => void;
}> = {}) {
  return render(
    <CreateSourceConnectionDialog
      airweaveCollectionReadableId="acme-x-deadbeef"
      open
      onOpenChange={overrides.onOpenChange ?? vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({
    sourceConnection: { id: "src-1" },
    sessionToken: "tok-fresh",
  });
  mockUseCreate.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
});

afterEach(() => vi.clearAllMocks());

// ── A11y MED remediation (review pass) ───────────────────────────────────

describe("CreateSourceConnectionDialog — credentials a11y wiring", () => {
  it("credentials textarea has aria-invalid=false initially and NO aria-describedby (clean state)", () => {
    renderDialog();
    const textarea = screen.getByLabelText(/credentials \(json\)/i);
    expect(textarea).toHaveAttribute("aria-invalid", "false");
    expect(textarea).not.toHaveAttribute("aria-describedby");
  });

  it("submitting invalid JSON sets aria-invalid=true, points aria-describedby at the alert, and announces via role=alert", async () => {
    renderDialog();
    const textarea = screen.getByLabelText(
      /credentials \(json\)/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "not json" } });
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Pg" },
    });
    fireEvent.change(screen.getByLabelText(/source type/i), {
      target: { value: "postgresql" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(textarea).toHaveAttribute("aria-invalid", "true");
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("id", "airweave-direct-credentials-error");
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "airweave-direct-credentials-error",
    );
    expect(alert).toHaveTextContent(/must be valid json/i);
  });
});

// ── Prior MED #4 — DirectAuthForm parse-then-validate branches ───────────

describe("CreateSourceConnectionDialog — DirectAuthForm parse-then-validate", () => {
  async function submitDirect(credentialsJson: string) {
    const textarea = screen.getByLabelText(/credentials \(json\)/i);
    fireEvent.change(textarea, { target: { value: credentialsJson } });
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Pg" },
    });
    fireEvent.change(screen.getByLabelText(/source type/i), {
      target: { value: "postgresql" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
  }

  it("JSON.parse throws → credentialsJsonError = 'Credentials must be valid JSON.'", async () => {
    renderDialog();
    await submitDirect("not json");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credentials must be valid JSON.",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("parsed value is an array → credentialsJsonError = 'Credentials must be a JSON object.'", async () => {
    renderDialog();
    await submitDirect("[1, 2, 3]");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credentials must be a JSON object.",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("parsed value is null → credentialsJsonError = 'Credentials must be a JSON object.'", async () => {
    renderDialog();
    await submitDirect("null");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credentials must be a JSON object.",
    );
  });

  it("parsed credentials is an empty object → Zod refine fires → inline credentials-required error", async () => {
    renderDialog();
    await submitDirect("{}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "At least one credential field is required",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("valid JSON + valid fields → calls the create mutation with the parsed credentials object", async () => {
    renderDialog();
    await submitDirect('{"token":"xoxb-secret"}');
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        airweaveCollectionReadableId: "acme-x-deadbeef",
        input: {
          name: "Pg",
          shortName: "postgresql",
          authentication: {
            kind: "direct",
            credentials: { token: "xoxb-secret" },
          },
        },
      });
    });
  });
});

// ── ADR-011 § Amendment 4 (2026-05-26) ───────────────────────────────────
// The OAuth-tab tests + BYOC-disclosure tests were removed because the
// OAuth tab itself is gone. OAuth source-connection creation happens
// inside the Airweave Connect catalog widget (opened from the page's
// "Connect a source" button) — no Velocity-side form, no pre-pinned
// shortName, no Velocity-managed BYOC pass-through. The widget shows
// the full source catalog and handles credential entry inline.
//
// Coverage for the catalog widget itself lives in:
//   - e2e/airweave/airweave-live.spec.ts ("SDK iframe actually mounts...")
//   - src/features/Airweave/hooks/__tests__/useAirweaveConnectModal.test.tsx
//   - src/features/Airweave/views/__tests__/AirweaveCollectionDetailPage.test.tsx
