export interface ChatConversation {
  id: string;
  title: string | null;
  organizationId: string;
  userId: string;
  projectId: string | null;
  projectName: string | null;
  projectSourceCount: number;
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

export interface ChatSqlCall {
  connectionId: string;
  connectionName: string;
  sql: string;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
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
    sqlCalls?: ChatSqlCall[];
  } | null;
  createdAt: string;
}

export interface CreateConversationInput {
  title?: string | null;
  organizationId?: string;
  projectId: string;
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
      type: "sql_executed";
      call: ChatSqlCall;
    }
  | {
      type: "complete";
      data: SendChatMessageResponse;
    };