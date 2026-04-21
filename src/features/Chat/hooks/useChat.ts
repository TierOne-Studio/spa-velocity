import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { getActiveOrganizationId } from "@/shared/utils/roles";
import { chatService } from "../services/chatService";
import type { CreateConversationInput } from "../types";

type ChatQueryScope = {
  organizationId?: string | null;
  userId?: string | null;
};

export const chatKeys = {
  all: ["chat"] as const,
  conversations: (scope?: ChatQueryScope) =>
    [
      ...chatKeys.all,
      "conversations",
      scope?.userId ?? "anonymous",
      scope?.organizationId ?? "no-org",
    ] as const,
  messages: (conversationId: string, scope?: ChatQueryScope) =>
    [
      ...chatKeys.all,
      "messages",
      scope?.userId ?? "anonymous",
      scope?.organizationId ?? "no-org",
      conversationId,
    ] as const,
};

function useChatQueryScope(requestedOrganizationId?: string | null): ChatQueryScope {
  const { data: session } = useEffectiveSession();
  const activeOrganizationId = getActiveOrganizationId(session);

  return {
    userId: session?.user?.id ?? null,
    organizationId: requestedOrganizationId ?? activeOrganizationId,
  };
}

export function useChatConversations(options?: {
  organizationId?: string | null;
  projectId?: string | null;
  enabled?: boolean;
}) {
  const scope = useChatQueryScope(options?.organizationId);
  const projectId = options?.projectId ?? null;

  return useQuery({
    queryKey: [...chatKeys.conversations(scope), projectId ?? "all-projects"] as const,
    queryFn: () => chatService.getConversations(options?.organizationId, projectId),
    enabled: options?.enabled ?? true,
  });
}

export function useChatMessages(conversationId: string, options?: { organizationId?: string | null; enabled?: boolean }) {
  const scope = useChatQueryScope(options?.organizationId);

  return useQuery({
    queryKey: chatKeys.messages(conversationId, scope),
    queryFn: () => chatService.getMessages(conversationId, options?.organizationId),
    enabled: options?.enabled ?? !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConversationInput) => chatService.createConversation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, organizationId }: { conversationId: string; organizationId?: string | null }) =>
      chatService.deleteConversation(conversationId, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}