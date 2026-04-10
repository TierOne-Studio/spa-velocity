import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissionsContext } from "@/shared/context/PermissionsContext";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { isSuperadminRole, getActiveOrganizationId, getSessionUserRole } from "@/shared/utils/roles";
import { useOrganizations } from "@/features/Admin/hooks/useOrganizations";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
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
import { ChatMessage as ChatMessageComponent } from "../components/ChatMessage";
import { GenerationStatus, type GenerationStage } from "../components/GenerationStatus";
import { ChatInput } from "../components/ChatInput";

type StreamingState = {
  conversationId: string;
  stage: GenerationStage;
  searchQuery?: string;
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

export function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { can } = usePermissionsContext();
  const { data: session } = useEffectiveSession();
  const activeOrganizationId = getActiveOrganizationId(session);
  const isSuperadmin = isSuperadminRole(getSessionUserRole(session));
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(activeOrganizationId ?? "");
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    if (!streaming || resolvedConversationId !== streaming.conversationId) {
      return;
    }

    const hasPersistedAssistantMessage = messages.some(
      (message) => message.role === "assistant" && message.content === streaming.content,
    );

    if (hasPersistedAssistantMessage) {
      setStreaming(null);
    }
  }, [messages, resolvedConversationId, streaming]);

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

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const handleOrganizationChange = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    setPendingConversationId(null);
    setStreaming(null);
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
      setStreaming(null);
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

  const handleSend = async (content: string) => {
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

      setStreaming({ conversationId: nextConversationId, stage: "thinking", content: "" });

      await chatService.sendMessage({
        conversationId: nextConversationId,
        content,
        organizationId: resolvedOrganizationId,
        onEvent: (event) => {
          if (event.type === "thinking") {
            setStreaming((current) => {
              if (!current || current.conversationId !== nextConversationId) return current;
              return { ...current, stage: "thinking" };
            });
          }

          if (event.type === "searching") {
            setStreaming((current) => {
              if (!current || current.conversationId !== nextConversationId) return current;
              return { ...current, stage: "searching", searchQuery: event.query };
            });
          }

          if (event.type === "chunk") {
            setStreaming((current) => {
              if (!current || current.conversationId !== nextConversationId) {
                return { conversationId: nextConversationId, stage: "responding", content: event.content };
              }

              return {
                ...current,
                stage: "responding",
                content: `${current.content}${event.content}`,
              };
            });
          }

          if (event.type === "complete") {
            setStreaming({
              conversationId: nextConversationId,
              stage: "idle",
              content: event.data.assistantMessage.content,
            });
          }
        },
      });

      await queryClient.invalidateQueries({ queryKey: chatKeys.all });
    } catch (error) {
      setStreaming(null);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  const handleStopGeneration = () => {
    // TODO: implement abort controller for SSE connection
    setStreaming(null);
    toast.info("Generation stopped");
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

  const isStreaming = streaming !== null && streaming.stage !== "idle";

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

          <Card className="lg:col-span-2 flex flex-col">
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
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border p-4 max-h-[500px]">
                {areMessagesLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
                ) : messages.length === 0 && !isStreaming ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Ask a question about this organization to start the conversation.
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <ChatMessageComponent
                        key={message.id}
                        content={message.content}
                        role={message.role}
                        sources={getSources(message)}
                        generator={message.metadata?.generator}
                        createdAt={message.createdAt}
                      />
                    ))}

                    {streaming && streaming.conversationId === resolvedConversationId && (
                      <>
                        {streaming.stage !== "idle" && streaming.stage !== "responding" && (
                          <GenerationStatus
                            stage={streaming.stage}
                            searchQuery={streaming.searchQuery}
                          />
                        )}

                        {streaming.content && (
                          <ChatMessageComponent
                            content={streaming.content}
                            role="assistant"
                          />
                        )}
                      </>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              <ChatInput
                onSend={(content) => void handleSend(content)}
                onStopGeneration={handleStopGeneration}
                isLoading={isStreaming}
                disabled={createConversation.isPending || !resolvedOrganizationId}
              />
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
