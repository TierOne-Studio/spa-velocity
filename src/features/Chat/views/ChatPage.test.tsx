import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockUseChatConversations = vi.fn();
const mockUseChatMessages = vi.fn();
const mockUseCreateConversation = vi.fn();
const mockUseDeleteConversation = vi.fn();
const mockUsePermissionsContext = vi.fn();
const mockUseEffectiveSession = vi.fn();
const mockUseOrganizations = vi.fn();
const mockChatServiceSendMessage = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("../hooks/useChat", () => ({
  chatKeys: {
    all: ["chat"],
    conversations: () => ["chat", "conversations"],
    messages: (conversationId: string) => ["chat", "messages", conversationId],
  },
  useChatConversations: (...args: unknown[]) => mockUseChatConversations(...args),
  useChatMessages: (...args: unknown[]) => mockUseChatMessages(...args),
  useCreateConversation: () => mockUseCreateConversation(),
  useDeleteConversation: () => mockUseDeleteConversation(),
}));

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => mockUsePermissionsContext(),
}));

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

vi.mock("@/features/Admin/hooks/useOrganizations", () => ({
  useOrganizations: (...args: unknown[]) => mockUseOrganizations(...args),
}));

vi.mock("@/shared/components/ui/select", () => ({
  Select: ({ children, value, disabled, onValueChange }: { children: ReactNode; value?: string; disabled?: boolean; onValueChange?: (value: string) => void }) => (
    <select value={value ?? ""} disabled={disabled} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value, disabled }: { children: ReactNode; value: string; disabled?: boolean }) => <option value={value} disabled={disabled}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("../services/chatService", () => ({
  chatService: {
    sendMessage: (...args: unknown[]) => mockChatServiceSendMessage(...args),
  },
}));

const mockToastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="react-markdown">{children}</div>,
}));

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import { ChatPage } from "./ChatPage";

const conversations = [
  {
    id: "conversation-1",
    title: "Deployments",
    organizationId: "org-1",
    userId: "user-1",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:10:00.000Z",
    lastMessagePreview: "How do deployments work?",
    lastMessageAt: "2026-04-03T00:10:00.000Z",
    messageCount: 2,
  },
];

const messages = [
  {
    id: "message-1",
    conversationId: "conversation-1",
    role: "assistant",
    content: "## Answer\n\nUse the deployment workflow.",
    metadata: {
      sources: [
        {
          name: "Deploy Guide",
          webUrl: "https://example.com/deploy-guide",
          sourceName: "github",
          entityType: "file",
        },
      ],
    },
    createdAt: "2026-04-03T00:10:00.000Z",
  },
];

function renderPage(initialEntry = "/chat/conversation-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseChatConversations.mockReturnValue({
      data: conversations,
      isLoading: false,
    });
    mockUseChatMessages.mockReturnValue({
      data: messages,
      isLoading: false,
    });
    mockUseCreateConversation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(conversations[0]),
      isPending: false,
    });
    mockUseDeleteConversation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mockChatServiceSendMessage.mockResolvedValue({
      conversation: conversations[0],
      userMessage: {
        id: "message-user-1",
        conversationId: "conversation-1",
        role: "user",
        content: "How do deployments work?",
        metadata: null,
        createdAt: "2026-04-03T00:11:00.000Z",
      },
      assistantMessage: messages[0],
    });
    mockUsePermissionsContext.mockReturnValue({
      can: (resource: string, action: string) =>
        (resource === "organization" && action === "read") ||
        (resource === "chat" && ["read", "create", "stream", "delete"].includes(action)),
    });
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "user-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
    });
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "TierOne", slug: "tier-one" },
          { id: "org-2", name: "Second Org", slug: "second-org" },
        ],
      },
      isLoading: false,
    });
  });

  it("shows an organization selection message when there is no active organization", () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "user-1", role: "manager" },
        session: {},
      },
    });

    renderPage("/chat");

    expect(screen.getByText(/select an organization first/i)).toBeInTheDocument();
    expect(screen.getByText(/chat is scoped to your active organization/i)).toBeInTheDocument();
  });

  it("shows a superadmin organization selector when no active organization is set", () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "superadmin-1", role: "superadmin" },
        session: {},
      },
    });

    renderPage("/chat");

    expect(screen.getByText(/select an organization first/i)).toBeInTheDocument();
    expect(screen.getByText(/superadmin chat can target any organization/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders conversations and messages for the active organization", () => {
    renderPage("/chat/conversation-1");

    expect(screen.getByText(/how do deployments work\?/i)).toBeInTheDocument();
    expect(screen.getByText(/use the deployment workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/deploy guide/i)).toBeInTheDocument();
  });

  it("normalizes markdown and html in the left rail preview", () => {
    mockUseChatConversations.mockReturnValue({
      data: [
        {
          ...conversations[0],
          lastMessagePreview: "## Overview\n\nTierOne is organized around **permission-based RBAC** with <strong>admin APIs</strong>.",
        },
      ],
      isLoading: false,
    });

    renderPage("/chat/conversation-1");

    expect(screen.getByText(/permission-based rbac/i)).toBeInTheDocument();
    expect(screen.getByText(/admin apis\./i)).toBeInTheDocument();
    expect(screen.queryByText(/\*\*permission-based rbac\*\*/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<strong>/i)).not.toBeInTheDocument();
  });

  it("creates a new conversation from the left-side New button", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({ ...conversations[0], id: "conversation-2" });
    mockUseCreateConversation.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false });
    mockUseChatMessages.mockImplementation((conversationId: string) => ({
      data: conversationId === "conversation-2" ? [] : messages,
      isLoading: false,
    }));

    renderPage("/chat/conversation-1");

    fireEvent.click(screen.getByRole("button", { name: /^new$/i }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        organizationId: "org-1",
      });
      expect(mockUseChatMessages).toHaveBeenLastCalledWith(
        "conversation-2",
        expect.objectContaining({
          organizationId: "org-1",
          enabled: true,
        }),
      );
    });

    expect(screen.getByRole("heading", { name: /^new conversation$/i })).toBeInTheDocument();
    expect(screen.getByText(/ask a question about this organization to start the conversation/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new conversation/i })).not.toBeInTheDocument();
  });

  it("creates a conversation before sending the first message", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({ ...conversations[0], id: "conversation-2" });
    mockUseChatConversations.mockReturnValue({ data: [], isLoading: false });
    mockUseChatMessages.mockReturnValue({ data: [], isLoading: false });
    mockUseCreateConversation.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false });

    renderPage("/chat");

    fireEvent.change(screen.getByPlaceholderText(/ask a question about this organization/i), {
      target: { value: "How do deployments work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        organizationId: "org-1",
      });
      expect(mockChatServiceSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-2",
          content: "How do deployments work?",
          organizationId: "org-1",
        }),
      );
    });
  });

  it("uses the selected superadmin organization when sending the first message", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({ ...conversations[0], id: "conversation-2", organizationId: "org-2" });
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "superadmin-1", role: "superadmin" },
        session: {},
      },
    });
    mockUseChatConversations.mockReturnValue({ data: [], isLoading: false });
    mockUseChatMessages.mockReturnValue({ data: [], isLoading: false });
    mockUseCreateConversation.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false });

    renderPage("/chat");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "org-2" } });
    fireEvent.change(screen.getByPlaceholderText(/ask a question about this organization/i), {
      target: { value: "How do deployments work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        organizationId: "org-2",
      });
      expect(mockChatServiceSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-2",
          content: "How do deployments work?",
          organizationId: "org-2",
        }),
      );
    });
  });

  it("renders a dev-only degraded-mode badge when the assistant generator is a fallback", () => {
    mockUseChatMessages.mockReturnValue({
      data: [
        {
          ...messages[0],
          metadata: {
            ...messages[0].metadata,
            generator: "fallback-search-summary",
          },
        },
      ],
      isLoading: false,
    });

    renderPage("/chat/conversation-1");

    expect(screen.getByText(/degraded mode/i)).toBeInTheDocument();
  });

  it("does not render the degraded-mode badge when the generator is healthy", () => {
    mockUseChatMessages.mockReturnValue({
      data: [
        {
          ...messages[0],
          metadata: {
            ...messages[0].metadata,
            generator: "langchain-openai",
          },
        },
      ],
      isLoading: false,
    });

    renderPage("/chat/conversation-1");

    expect(screen.queryByText(/degraded mode/i)).not.toBeInTheDocument();
  });

  it("deletes the selected conversation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteConversation.mockReturnValue({ mutateAsync, isPending: false });

    renderPage("/chat/conversation-1");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        organizationId: "org-1",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Conversation deleted");
    });
  });
});