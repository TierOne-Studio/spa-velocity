import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconArrowsRightLeft, IconBooks, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconPlus, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissionsContext } from "@/shared/context/PermissionsContext";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { cn } from "@/shared/lib/utils";
import { getActiveOrganizationId } from "@/shared/utils/roles";
import { Button } from "@/shared/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Skeleton } from "@/shared/components/ui/skeleton";
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
import { PickProjectDialog } from "../components/PickProjectDialog";
import { ProjectSourcesDrawer } from "../components/ProjectSourcesDrawer";

type StreamingState = {
  conversationId: string;
  stage: GenerationStage;
  searchQuery?: string;
  content: string;
};

type ConversationGroup = {
  label: string;
  projectId: string | null;
  projectSourceCount: number;
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

function groupConversations(conversations: ChatConversation[]): ConversationGroup[] {
  const groups = new Map<
    string,
    { label: string; projectId: string | null; projectSourceCount: number; conversations: ChatConversation[] }
  >();

  for (const conversation of conversations) {
    const key = conversation.projectId ?? "__no_project__";
    const existing = groups.get(key);
    if (existing) {
      existing.conversations.push(conversation);
      existing.projectSourceCount = Math.max(
        existing.projectSourceCount,
        conversation.projectSourceCount ?? 0,
      );
    } else {
      groups.set(key, {
        label: conversation.projectName ?? "Unassigned",
        projectId: conversation.projectId ?? null,
        projectSourceCount: conversation.projectSourceCount ?? 0,
        conversations: [conversation],
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      conversations: [...group.conversations].sort((a, b) => {
        const aTime = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
        const bTime = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
        return bTime - aTime;
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
              <div
                key={group.projectId ?? group.label}
                className="flex flex-col gap-1.5"
                data-testid={`rail-project-group-${group.projectId ?? "unassigned"}`}
              >
                <div className="flex items-center justify-between gap-2 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <IconBooks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {group.projectSourceCount} {group.projectSourceCount === 1 ? "source" : "sources"}
                  </span>
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
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [isPickProjectOpen, setIsPickProjectOpen] = useState(false);
  const [isSwitchProjectOpen, setIsSwitchProjectOpen] = useState(false);
  const [isSourcesDrawerOpen, setIsSourcesDrawerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const resolvedOrganizationId = activeOrganizationId || null;

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

  const handleCreateConversation = () => {
    if (!resolvedOrganizationId) {
      return;
    }
    setIsPickProjectOpen(true);
  };

  const handleCreateConversationForProject = async (projectId: string) => {
    if (!resolvedOrganizationId) {
      return;
    }

    try {
      const conversation = await createConversation.mutateAsync({
        organizationId: resolvedOrganizationId,
        projectId,
      });
      setPendingConversationId(conversation.id);
      setIsMobileRailOpen(false);
      setIsPickProjectOpen(false);
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
      const nextConversationId = resolvedConversationId;

      if (!nextConversationId) {
        setIsPickProjectOpen(true);
        return;
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
              Use the Organization switcher in the sidebar to pick an organization. Projects and conversations are scoped to the active organization.
            </CardDescription>
          </CardHeader>
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
                  {selectedConversation?.projectName ? (
                    <button
                      type="button"
                      onClick={() => setIsSourcesDrawerOpen(true)}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent"
                      data-testid="chat-project-chip"
                    >
                      <IconBooks className="h-3 w-3" />
                      <span className="font-medium">{selectedConversation.projectName}</span>
                      <span className="text-muted-foreground">
                        · {selectedConversation.projectSourceCount}{" "}
                        {selectedConversation.projectSourceCount === 1 ? "source" : "sources"}
                      </span>
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ask project-scoped questions against the linked data sources.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 lg:justify-end">
                {resolvedConversationId && can("chat", "create") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSwitchProjectOpen(true)}
                    data-testid="chat-switch-project-button"
                  >
                    <IconArrowsRightLeft className="mr-2 h-4 w-4" />
                    Switch project
                  </Button>
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
                    Ask a question about this project to start the conversation.
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

      <PickProjectDialog
        open={isPickProjectOpen}
        onOpenChange={setIsPickProjectOpen}
        organizationId={resolvedOrganizationId}
        onSelect={(projectId) => void handleCreateConversationForProject(projectId)}
      />

      <PickProjectDialog
        open={isSwitchProjectOpen}
        onOpenChange={setIsSwitchProjectOpen}
        organizationId={resolvedOrganizationId}
        currentProjectId={selectedConversation?.projectId ?? null}
        onSelect={(projectId) => {
          setIsSwitchProjectOpen(false);
          if (projectId === selectedConversation?.projectId) return;
          void handleCreateConversationForProject(projectId);
        }}
      />

      <ProjectSourcesDrawer
        projectId={selectedConversation?.projectId ?? null}
        open={isSourcesDrawerOpen}
        onOpenChange={setIsSourcesDrawerOpen}
      />
    </div>
  );
}
