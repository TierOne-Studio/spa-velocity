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
  onOAuthSubmit: (token: string) => void;
}> = {}) {
  return render(
    <CreateSourceConnectionDialog
      collectionReadableId="acme-x-deadbeef"
      open
      onOpenChange={overrides.onOpenChange ?? vi.fn()}
      onOAuthSubmit={overrides.onOAuthSubmit}
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
        collectionReadableId: "acme-x-deadbeef",
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

// ── Prior MED #5 — OAuthForm success-without-sessionToken ────────────────

describe("CreateSourceConnectionDialog — OAuth success-without-sessionToken branch", () => {
  async function switchToOAuthTabAndSubmit({
    name = "Slack",
    shortName = "slack",
  } = {}) {
    // Click the OAuth tab trigger → React state in our stubbed Tabs
    // re-renders with the OAuth panel active. Then fill + submit.
    fireEvent.click(screen.getByRole("button", { name: /^oauth$/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: name },
    });
    fireEvent.change(screen.getByLabelText(/source type/i), {
      target: { value: shortName },
    });
    fireEvent.click(screen.getByRole("button", { name: /start oauth/i }));
  }

  it("create resolves WITH sessionToken → onOAuthSubmit(token) + dialog closes (happy path)", async () => {
    const onOpenChange = vi.fn();
    const onOAuthSubmit = vi.fn();
    renderDialog({ onOpenChange, onOAuthSubmit });
    await switchToOAuthTabAndSubmit();

    await waitFor(() => {
      expect(onOAuthSubmit).toHaveBeenCalledWith("tok-fresh");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("create resolves with NO sessionToken → toast.error + dialog closes; onOAuthSubmit NOT invoked", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      sourceConnection: { id: "src-orphan" },
      // No sessionToken — contract violation. Backend would never
      // legitimately return this; defensive UX nonetheless.
    });
    const onOpenChange = vi.fn();
    const onOAuthSubmit = vi.fn();
    renderDialog({ onOpenChange, onOAuthSubmit });
    await switchToOAuthTabAndSubmit();

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/no OAuth session token/i),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOAuthSubmit).not.toHaveBeenCalled();
  });
});

// ── ADR-011 § Amendment 3 — BYOC pass-through ────────────────────────────

describe("CreateSourceConnectionDialog — OAuth BYOC fields (ADR-011 Amendment 3)", () => {
  it("forwards filled BYOC fields (clientId/clientSecret) to the create mutation in the authentication payload", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /^oauth$/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Acme Slack" },
    });
    fireEvent.change(screen.getByLabelText(/source type/i), {
      target: { value: "slack" },
    });
    // Expand the BYOC <details> and fill the OAuth2 fields. The native
    // <summary> click toggles `open`; React state in OAuthForm syncs
    // via the onToggle handler so the field inputs render.
    fireEvent.click(
      screen.getByText(/advanced — bring your own oauth app/i),
    );
    fireEvent.change(screen.getByLabelText(/client id \(oauth2\)/i), {
      target: { value: "client-abc" },
    });
    fireEvent.change(screen.getByLabelText(/client secret \(oauth2\)/i), {
      target: { value: "secret-xyz" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start oauth/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        collectionReadableId: "acme-x-deadbeef",
        input: {
          name: "Acme Slack",
          shortName: "slack",
          authentication: {
            kind: "oauth",
            clientId: "client-abc",
            clientSecret: "secret-xyz",
          },
        },
      });
    });
  });

  it("submitting OAuth WITHOUT opening the BYOC disclosure sends only kind:oauth — empty BYOC fields are stripped to undefined by the Zod transform", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /^oauth$/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Acme Slack" },
    });
    fireEvent.change(screen.getByLabelText(/source type/i), {
      target: { value: "slack" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start oauth/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        collectionReadableId: "acme-x-deadbeef",
        input: {
          name: "Acme Slack",
          shortName: "slack",
          authentication: { kind: "oauth" },
        },
      });
    });
  });
});
