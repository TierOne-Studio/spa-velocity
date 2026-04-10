export interface ChatConversation {
  id: string;
  title: string | null;
  organizationId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}

export interface ChatSource {
  name: string;
  webUrl: string;
  sourceName: string;
  entityType: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: {
    generator?: string;
    sources?: ChatSource[];
    resultCount?: number;
  } | null;
  createdAt: string;
}

export interface CreateConversationInput {
  title?: string | null;
  organizationId?: string;
}

export interface SendChatMessageInput {
  conversationId: string;
  content: string;
  organizationId?: string;
  onEvent?: (event: ChatStreamEvent) => void;
}

export interface SendChatMessageResponse {
  conversation: ChatConversation;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export type ChatStreamEvent =
  | {
      type: "start";
      conversation: ChatConversation;
      userMessage: ChatMessage;
    }
  | {
      type: "thinking";
    }
  | {
      type: "searching";
      query: string;
    }
  | {
      type: "chunk";
      content: string;
    }
  | {
      type: "complete";
      data: SendChatMessageResponse;
    };