import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconMessageCircle, IconPlus, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { usePermissionsContext } from "@/shared/context/PermissionsContext";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { isSuperadminRole, getActiveOrganizationId, getSessionUserRole } from "@/shared/utils/roles";
import { useOrganizations } from "@/features/Admin/hooks/useOrganizations";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { chatService } from "../services/chatService";
import {
  chatKeys,
  useChatConversations,
  useChatMessages,
  useCreateConversation,
  useDeleteConversation,
} from "../hooks/useChat";
import type { ChatMessage, ChatSource } from "../types";

type StreamingAssistantState = {
  conversationId: string;
  content: string;
};

type OrganizationOption = {
  id: string;
  name: string;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No messages yet";
  }

  return new Date(value).toLocaleString();
}

function getSources(message: ChatMessage): ChatSource[] {
  const sources = message.metadata?.sources;
  return Array.isArray(sources) ? sources : [];
}

function isDegradedGenerator(message: ChatMessage): boolean {
  const generator = message.metadata?.generator;
  return typeof generator === "string" && generator.startsWith("fallback-");
}

export function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { can } = usePermissionsContext();
  const { data: session } = useEffectiveSession();
  const activeOrganizationId = getActiveOrganizationId(session);
  const isSuperadmin = isSuperadminRole(getSessionUserRole(session));
  const [draft, setDraft] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(activeOrganizationId ?? "");
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [streamingAssistant, setStreamingAssistant] = useState<StreamingAssistantState | null>(null);
  const { data: organizationsResponse, isLoading: areOrganizationsLoading } = useOrganizations(
    { page: 1, limit: 100 },
    { enabled: isSuperadmin },
  );
  const organizations = useMemo<OrganizationOption[]>(
    () => organizationsResponse?.data ?? [],
    [organizationsResponse?.data],
  );
  const resolvedOrganizationId = isSuperadmin ? selectedOrganizationId || null : activeOrganizationId;

  const { data: conversations = [], isLoading: areConversationsLoading } = useChatConversations({
    organizationId: resolvedOrganizationId,
    enabled: !!resolvedOrganizationId && can("organization", "read"),
  });
  const selectedConversation = conversations.find((conversation) => conversation.id === conversationId) ?? null;
  const resolvedConversationId =
    selectedConversation?.id ?? (conversationId === pendingConversationId ? pendingConversationId : null) ?? conversations[0]?.id ?? "";
  const { data: messages = [], isLoading: areMessagesLoading } = useChatMessages(resolvedConversationId, {
    organizationId: resolvedOrganizationId,
    enabled: !!resolvedConversationId,
  });

  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  useEffect(() => {
    if (!isSuperadmin) {
      setSelectedOrganizationId("");
      return;
    }

    setSelectedOrganizationId((current) => {
      if (activeOrganizationId && organizations.some((organization) => organization.id === activeOrganizationId)) {
        return activeOrganizationId;
      }

      if (current && organizations.some((organization) => organization.id === current)) {
        return current;
      }

      if (organizations.length === 1) {
        return organizations[0].id;
      }

      return "";
    });
  }, [activeOrganizationId, isSuperadmin, organizations]);

  useEffect(() => {
    if (!streamingAssistant || resolvedConversationId !== streamingAssistant.conversationId) {
      return;
    }

    const hasPersistedAssistantMessage = messages.some(
      (message) => message.role === "assistant" && message.content === streamingAssistant.content,
    );

    if (hasPersistedAssistantMessage) {
      setStreamingAssistant(null);
    }
  }, [messages, resolvedConversationId, streamingAssistant]);

  useEffect(() => {
    if (selectedConversation?.id && selectedConversation.id === pendingConversationId) {
      setPendingConversationId(null);
    }
  }, [pendingConversationId, selectedConversation]);

  useEffect(() => {
    if (!resolvedOrganizationId) {
      return;
    }

    if (!conversationId && conversations[0]) {
      navigate(`/chat/${conversations[0].id}`, { replace: true });
      return;
    }

    if (conversationId && !selectedConversation && conversationId !== pendingConversationId) {
      navigate(conversations[0] ? `/chat/${conversations[0].id}` : "/chat", { replace: true });
    }
  }, [conversationId, conversations, navigate, pendingConversationId, resolvedOrganizationId, selectedConversation]);

  const handleOrganizationChange = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    setPendingConversationId(null);
    setStreamingAssistant(null);
    setDraft("");
    navigate("/chat", { replace: true });
  };

  const handleCreateConversation = async () => {
    if (!resolvedOrganizationId) {
      return;
    }

    try {
      const conversation = await createConversation.mutateAsync({
        organizationId: resolvedOrganizationId,
      });
      setPendingConversationId(conversation.id);
      setStreamingAssistant(null);
      setDraft("");
      navigate(`/chat/${conversation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create conversation");
    }
  };

  const handleSelectConversation = (nextConversationId: string) => {
    if (!resolvedOrganizationId) {
      return;
    }

    setPendingConversationId(null);
    navigate(`/chat/${nextConversationId}`);
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!resolvedOrganizationId || !content) {
      return;
    }

    try {
      let nextConversationId = resolvedConversationId;

      if (!nextConversationId) {
        const conversation = await createConversation.mutateAsync({
          organizationId: resolvedOrganizationId,
        });
        nextConversationId = conversation.id;
        setPendingConversationId(conversation.id);
        navigate(`/chat/${conversation.id}`);
      }

      setStreamingAssistant({ conversationId: nextConversationId, content: "" });

      await chatService.sendMessage({
        conversationId: nextConversationId,
        content,
        organizationId: resolvedOrganizationId,
        onEvent: (event) => {
          if (event.type === "chunk") {
            setStreamingAssistant((current) => {
              if (!current || current.conversationId !== nextConversationId) {
                return { conversationId: nextConversationId, content: event.content };
              }

              return {
                ...current,
                content: `${current.content}${event.content}`,
              };
            });
          }

          if (event.type === "complete") {
            setStreamingAssistant({
              conversationId: nextConversationId,
              content: event.data.assistantMessage.content,
            });
          }
        },
      });

      await queryClient.invalidateQueries({ queryKey: chatKeys.all });
      setDraft("");
    } catch (error) {
      setStreamingAssistant(null);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  const handleDeleteConversation = async () => {
    if (!resolvedConversationId) {
      return;
    }

    try {
      await deleteConversation.mutateAsync({
        conversationId: resolvedConversationId,
        organizationId: resolvedOrganizationId,
      });
      setPendingConversationId(null);
      toast.success("Conversation deleted");
      navigate("/chat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete conversation");
    }
  };

  if (!can("organization", "read")) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Chat unavailable</CardTitle>
            <CardDescription>You do not have permission to access organization-backed chat.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!resolvedOrganizationId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Select an organization first</CardTitle>
            <CardDescription>
              {isSuperadmin
                ? "Superadmin chat can target any organization and its linked Airweave collection."
                : "Chat is scoped to your active organization and its linked Airweave collection."}
            </CardDescription>
          </CardHeader>
          {isSuperadmin && (
            <CardContent className="max-w-sm">
              <div className="grid gap-2">
                <Label htmlFor="chat-organization-select">Organization</Label>
                <Select
                  value={selectedOrganizationId}
                  disabled={areOrganizationsLoading || organizations.length === 0}
                  onValueChange={handleOrganizationChange}
                >
                  <SelectTrigger id="chat-organization-select" className="w-full">
                    <SelectValue
                      placeholder={areOrganizationsLoading ? "Loading organizations..." : "Select organization"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                    {organizations.length === 0 && !areOrganizationsLoading && (
                      <SelectItem value="no-organizations" disabled>
                        No organizations available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="text-muted-foreground">
            Ask organization-scoped questions against the linked Airweave collection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperadmin && (
            <div className="grid gap-2">
              <Label htmlFor="chat-organization-active-select" className="text-xs text-muted-foreground">
                Organization
              </Label>
              <Select
                value={selectedOrganizationId}
                disabled={areOrganizationsLoading || organizations.length === 0}
                onValueChange={handleOrganizationChange}
              >
                <SelectTrigger id="chat-organization-active-select" className="w-[220px]">
                  <SelectValue placeholder={areOrganizationsLoading ? "Loading organizations..." : "Select organization"} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Conversations</CardTitle>
                <CardDescription>Private conversations in your active organization.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCreateConversation()}
                disabled={createConversation.isPending || !resolvedOrganizationId}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                {createConversation.isPending ? "Creating..." : "New"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {areConversationsLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
              ) : conversations.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No conversations yet. Ask the first question to create one.
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      conversation.id === resolvedConversationId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <div className="font-medium">
                      {conversation.title || "Untitled conversation"}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {conversation.lastMessagePreview || "No messages yet"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatTimestamp(conversation.lastMessageAt)}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{selectedConversation?.title || "New conversation"}</CardTitle>
                <CardDescription>
                  Responses are grounded in the organization&apos;s linked collection and connected sources.
                </CardDescription>
              </div>
              {resolvedConversationId && (
                <Button variant="destructive" size="sm" onClick={handleDeleteConversation}>
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[500px] space-y-4 overflow-y-auto rounded-lg border p-4">
                {areMessagesLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
                ) : messages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Ask a question about this organization to start the conversation.
                  </div>
                ) : (
                  [...messages].map((message) => {
                    const sources = getSources(message);
                    const showDegradedBadge =
                      import.meta.env.DEV &&
                      message.role === "assistant" &&
                      isDegradedGenerator(message);

                    return (
                      <div
                        key={message.id}
                        className={`rounded-lg border p-4 ${message.role === "user" ? "bg-muted/40" : "bg-background"}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="font-medium capitalize">{message.role}</div>
                            {showDegradedBadge && (
                              <span
                                className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400"
                                title={`Generator: ${message.metadata?.generator ?? "unknown"}. Visible in dev only.`}
                              >
                                degraded mode
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-6">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                        )}
                        {sources.length > 0 && (
                          <>
                            <Separator className="my-3" />
                            <div className="space-y-2 text-xs text-muted-foreground">
                              <div className="font-medium text-foreground">Sources</div>
                              {sources.map((source) => {
                                const isSafeUrl = /^https?:\/\//i.test(source.webUrl);
                                return isSafeUrl ? (
                                  <a
                                    key={`${message.id}-${source.webUrl}`}
                                    href={source.webUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block underline-offset-4 hover:underline"
                                  >
                                    {source.name} · {source.sourceName}
                                  </a>
                                ) : (
                                  <span key={`${message.id}-${source.webUrl}`} className="block">
                                    {source.name} · {source.sourceName}
                                  </span>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
                {streamingAssistant && streamingAssistant.conversationId === resolvedConversationId && (
                  <div className="rounded-lg border bg-background p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-medium capitalize">assistant</div>
                      <div className="text-xs text-muted-foreground">Streaming...</div>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-6">
                      {streamingAssistant.content ? (
                        <ReactMarkdown>{streamingAssistant.content}</ReactMarkdown>
                      ) : (
                        "Thinking..."
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconMessageCircle className="h-4 w-4" />
                  {isSuperadmin ? "Selected organization chat" : "Active organization chat"}
                </div>
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask a question about this organization"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSend()}
                    disabled={createConversation.isPending || !draft.trim()}
                  >
                    {streamingAssistant ? "Streaming..." : createConversation.isPending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}