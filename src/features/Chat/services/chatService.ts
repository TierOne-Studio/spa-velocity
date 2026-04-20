import { fetchWithAuth } from "@/shared/lib/fetch-with-auth";
import type {
  ChatConversation,
  ChatStreamEvent,
  ChatMessage,
  CreateConversationInput,
  SendChatMessageInput,
  SendChatMessageResponse,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type ApiResponse<T> = {
  data: T;
};

type PendingSseEvent = {
  event: string;
  data: string;
};

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || fallbackMessage);
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

function extractSseEvents(buffer: string): { events: PendingSseEvent[]; remainder: string } {
  const rawEvents = buffer.split("\n\n");
  const remainder = rawEvents.pop() ?? "";

  const events = rawEvents
    .map((rawEvent) => {
      const lines = rawEvent.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLines = lines.filter((line) => line.startsWith("data:"));

      if (!eventLine || dataLines.length === 0) {
        return null;
      }

      return {
        event: eventLine.replace(/^event:\s*/, "").trim(),
        data: dataLines.map((line) => line.replace(/^data:\s*/, "")).join("\n"),
      } satisfies PendingSseEvent;
    })
    .filter((event): event is PendingSseEvent => event !== null);

  return { events, remainder };
}

async function parseStreamResponse(
  response: Response,
  onEvent?: (event: ChatStreamEvent) => void,
): Promise<SendChatMessageResponse> {
  if (!response.body) {
    throw new Error("Streaming response body is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData: SendChatMessageResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const parsed = extractSseEvents(buffer);
    buffer = parsed.remainder;

    for (const event of parsed.events) {
      const payload = JSON.parse(event.data) as unknown;

      if (event.event === "start") {
        const typedPayload = payload as {
          conversation: ChatConversation;
          userMessage: ChatMessage;
        };
        onEvent?.({ type: "start", ...typedPayload });
        continue;
      }

      if (event.event === "thinking") {
        onEvent?.({ type: "thinking" });
        continue;
      }

      if (event.event === "searching") {
        const typedPayload = payload as { query?: string };
        onEvent?.({ type: "searching", query: typedPayload.query ?? "" });
        continue;
      }

      if (event.event === "chunk") {
        const typedPayload = payload as { content?: string };
        onEvent?.({ type: "chunk", content: typedPayload.content ?? "" });
        continue;
      }

      if (event.event === "complete") {
        finalData = payload as SendChatMessageResponse;
        onEvent?.({ type: "complete", data: finalData });
        continue;
      }

      if (event.event === "error") {
        const typedPayload = payload as { message?: string };
        throw new Error(typedPayload.message || "Failed to stream message");
      }
    }

    if (done) {
      break;
    }
  }

  if (!finalData) {
    throw new Error("Streaming response completed without a final payload");
  }

  return finalData;
}

export const chatService = {
  async getConversations(
    organizationId?: string | null,
    projectId?: string | null,
  ): Promise<ChatConversation[]> {
    const url = new URL(`${API_BASE_URL}/api/chat/conversations`);
    if (organizationId) {
      url.searchParams.set("organizationId", organizationId);
    }
    if (projectId) {
      url.searchParams.set("projectId", projectId);
    }

    const response = await fetchWithAuth(url.toString());
    return parseApiResponse<ChatConversation[]>(response, "Failed to fetch conversations");
  },

  async createConversation(input: CreateConversationInput): Promise<ChatConversation> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/chat/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return parseApiResponse<ChatConversation>(response, "Failed to create conversation");
  },

  async getMessages(conversationId: string, organizationId?: string | null): Promise<ChatMessage[]> {
    const url = new URL(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`);
    if (organizationId) {
      url.searchParams.set("organizationId", organizationId);
    }

    const response = await fetchWithAuth(url.toString());
    return parseApiResponse<ChatMessage[]>(response, "Failed to fetch messages");
  },

  async sendMessage(input: SendChatMessageInput): Promise<SendChatMessageResponse> {
    if (input.onEvent) {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/chat/conversations/${input.conversationId}/messages/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            content: input.content,
            organizationId: input.organizationId,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to send message");
      }

      return parseStreamResponse(response, input.onEvent);
    }

    const response = await fetchWithAuth(
      `${API_BASE_URL}/api/chat/conversations/${input.conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input.content,
          organizationId: input.organizationId,
        }),
      },
    );

    return parseApiResponse<SendChatMessageResponse>(response, "Failed to send message");
  },

  async deleteConversation(conversationId: string, organizationId?: string | null): Promise<void> {
    const url = new URL(`${API_BASE_URL}/api/chat/conversations/${conversationId}`);
    if (organizationId) {
      url.searchParams.set("organizationId", organizationId);
    }

    const response = await fetchWithAuth(url.toString(), {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete conversation");
    }
  },
};