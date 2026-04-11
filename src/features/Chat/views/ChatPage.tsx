import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconPlus, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissionsContext } from "@/shared/context/PermissionsContext";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { cn } from "@/shared/lib/utils";
import { isSuperadminRole, getActiveOrganizationId, getSessionUserRole } from "@/shared/utils/roles";
import { useOrganizations } from "@/features/Admin/hooks/useOrganizations";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { chatService } from "../services/chatService";
import {
  chatKeys,
  useChatConversations,
  useChatMessages,
  useCreateConversation,
  useDeleteConversation,
} from "../hooks/useChat";
import type { ChatConversation, ChatMessage, ChatSource } from "../types";
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

type ConversationGroup = {
  label: string;
  conversations: ChatConversation[];
};

function formatConversationTimestamp(value: string | null) {
  if (!value) {
    return "No activity";
  }

  const date = new Date(value);
  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function formatConversationPreview(value: string | null) {
  if (!value) {
    return "No messages yet";
  }

  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[*-]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getConversationGroupLabel(value: string | null) {
  if (!value) {
    return "Older";
  }

  const today = startOfDay(new Date());
  const target = startOfDay(new Date(value));
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return "Previous 7 Days";
  }

  return "Older";
}

function groupConversations(conversations: ChatConversation[]): ConversationGroup[] {
  const order = ["Today", "Yesterday", "Previous 7 Days", "Older"] as const;
  const grouped = new Map<string, ChatConversation[]>();

  for (const conversation of conversations) {
    const label = getConversationGroupLabel(conversation.lastMessageAt ?? conversation.updatedAt);
    const existing = grouped.get(label) ?? [];
    existing.push(conversation);
    grouped.set(label, existing);
  }

  return order
    .map((label) => ({
      label,
      conversations: grouped.get(label) ?? [],
    }))
    .filter((group) => group.conversations.length > 0);
}

function getSources(message: ChatMessage): ChatSource[] {
  const sources = message.metadata?.sources;
  return Array.isArray(sources) ? sources : [];
}

type ConversationRailContentProps = {
  conversations: ChatConversation[];
  groups: ConversationGroup[];
  isLoading: boolean;
  resolvedConversationId: string;
  isCreatePending: boolean;
  resolvedOrganizationId: string | null;
  canCreate: boolean;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
};

function ConversationRailContent({
  conversations,
  groups,
  isLoading,
  resolvedConversationId,
  isCreatePending,
  resolvedOrganizationId,
  canCreate,
  onCreateConversation,
  onSelectConversation,
}: ConversationRailContentProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold">Chats</div>
            <div className="text-xs text-muted-foreground">Private history for the active organization.</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateConversation}
            disabled={isCreatePending || !resolvedOrganizationId || !canCreate}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            {isCreatePending ? "Creating..." : "New"}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 w-full rounded-2xl" />)
          ) : conversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              No conversations yet. Ask the first question to create one.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1.5">
                <div className="px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </div>
                {group.conversations.map((conversation) => {
                  const isActive = conversation.id === resolvedConversationId;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      className={cn(
                        "flex w-full flex-col gap-2 rounded-2xl px-3 py-3 text-left transition-colors",
                        isActive ? "bg-accent text-accent-foreground shadow-sm" : "hover:bg-accent/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="line-clamp-2 text-sm font-medium">
                          {conversation.title || "Untitled conversation"}
                        </div>
                        <div className="shrink-0 text-[11px] text-muted-foreground">
                          {formatConversationTimestamp(conversation.lastMessageAt ?? conversation.updatedAt)}
                        </div>
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        {formatConversationPreview(conversation.lastMessagePreview)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
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
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
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
    enabled: !!resolvedOrganizationId && can("chat", "read"),
  });
  const selectedConversation = conversations.find((conversation) => conversation.id === conversationId) ?? null;
  const resolvedConversationId =
    selectedConversation?.id ?? (conversationId === pendingConversationId ? pendingConversationId : null) ?? conversations[0]?.id ?? "";
  const { data: messages = [], isLoading: areMessagesLoading } = useChatMessages(resolvedConversationId, {
    organizationId: resolvedOrganizationId,
    enabled: !!resolvedConversationId,
  });
  const conversationGroups = useMemo(() => groupConversations(conversations), [conversations]);

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
    setIsMobileRailOpen(false);
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
      setIsMobileRailOpen(false);
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

    setIsMobileRailOpen(false);
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

  if (!can("chat", "read")) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Chat unavailable</CardTitle>
            <CardDescription>You do not have permission to access chat.</CardDescription>
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border bg-background shadow-sm">
        <div
          className={cn(
            "hidden border-r bg-muted/15 transition-all duration-200 ease-linear md:flex md:flex-col",
            isRailOpen ? "md:w-[320px]" : "md:w-0 md:border-r-0",
          )}
        >
          <div className={cn("flex h-full min-h-0 flex-col", !isRailOpen && "pointer-events-none opacity-0")}> 
            <ConversationRailContent
              conversations={conversations}
              groups={conversationGroups}
              isLoading={areConversationsLoading}
              resolvedConversationId={resolvedConversationId}
              isCreatePending={createConversation.isPending}
              resolvedOrganizationId={resolvedOrganizationId}
              canCreate={can("chat", "create")}
              onCreateConversation={() => void handleCreateConversation()}
              onSelectConversation={handleSelectConversation}
            />
          </div>
        </div>

        <Sheet open={isMobileRailOpen} onOpenChange={setIsMobileRailOpen}>
          <SheetContent side="left" className="w-full max-w-sm p-0">
            <SheetHeader className="border-b">
              <SheetTitle>Chats</SheetTitle>
              <SheetDescription>Browse or start conversations without leaving the current page.</SheetDescription>
            </SheetHeader>
            <ConversationRailContent
              conversations={conversations}
              groups={conversationGroups}
              isLoading={areConversationsLoading}
              resolvedConversationId={resolvedConversationId}
              isCreatePending={createConversation.isPending}
              resolvedOrganizationId={resolvedOrganizationId}
              canCreate={can("chat", "create")}
              onCreateConversation={() => void handleCreateConversation()}
              onSelectConversation={handleSelectConversation}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setIsMobileRailOpen(true)}
                  aria-label="Open chats"
                >
                  <IconLayoutSidebarLeftExpand className="h-4 w-4" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden md:inline-flex"
                      onClick={() => setIsRailOpen((current) => !current)}
                      aria-label={isRailOpen ? "Hide chats" : "Show chats"}
                    >
                      {isRailOpen ? <IconLayoutSidebarLeftCollapse className="h-4 w-4" /> : <IconLayoutSidebarLeftExpand className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRailOpen ? "Hide chats" : "Show chats"}
                  </TooltipContent>
                </Tooltip>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Chat</div>
                  <h1 className="truncate text-lg font-semibold">{selectedConversation?.title || "New conversation"}</h1>
                  <p className="text-sm text-muted-foreground">
                    Ask organization-scoped questions against the linked Airweave collection.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 lg:justify-end">
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

                {resolvedConversationId && can("chat", "delete") && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDeleteConversation}>
                    <IconTrash className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 md:px-6">
              {areMessagesLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className={cn("h-24 rounded-3xl", index === 1 ? "w-[80%]" : "w-full")} />
                ))
              ) : messages.length === 0 && !isStreaming ? (
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
                  <div className="text-xl font-semibold">New conversation</div>
                  <div className="max-w-md text-sm text-muted-foreground">
                    Ask a question about this organization to start the conversation.
                  </div>
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
                        <GenerationStatus stage={streaming.stage} searchQuery={streaming.searchQuery} />
                      )}

                      {streaming.content && <ChatMessageComponent content={streaming.content} role="assistant" />}
                    </>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t bg-background/95 px-4 py-4 backdrop-blur md:px-6">
            <div className="mx-auto w-full max-w-4xl">
              <ChatInput
                onSend={(content) => void handleSend(content)}
                onStopGeneration={handleStopGeneration}
                isLoading={isStreaming}
                disabled={createConversation.isPending || !resolvedOrganizationId || !can("chat", "stream")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
