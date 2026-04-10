# Chat — Natural Language Response Improvement Plan

**Status**: Phases 0–3 complete. Phase 4 in progress.
**Owner**: Mariano Ravinale
**Date**: 2026-04-08 (created) / 2026-04-10 (updated)
**Scope**: spa-velocity (frontend chat UI) + api-velocity (chat module, Airweave integration, LangChain pipeline)

---

## 1. Completed Phases Summary

### Phase 0 — Config + Observability (PR #2)

Set `OPENAI_API_KEY` in `.env`, documented all OpenAI vars in `.env.example`. Added `[ChatAgentService] reply generated` info log per request with `{ generator, sourceCount, resultCount, toolCallCount, durationMs }`. Added dev-only "degraded mode" badge in ChatPage.tsx when `metadata.generator` starts with `fallback-`.

### Phase 1 — Expert Persona Prompt (PR #2, #3)

Replaced the rigid `## Answer / ### Key Findings / ### Sources` default prompt with an external markdown file at `src/modules/chat/prompts/expert-persona-system.md`. Prompt loads lazily from file with three-tier resolution: inline env override → file path env override → bundled default. Made the persona source-agnostic ("expert knowledge assistant" that adapts to any indexed content), high-level-by-default (business value before implementation details), with an explicit "when context is insufficient" protocol.

### Phase 2 — Agentic RAG (PR #4, #5)

Replaced single-shot RAG with an agentic path using LangChain v1's `createAgent` + a `search_knowledge_base` tool. The LLM drives multiple Airweave retrievals per question, dedupes results by entityId, and synthesizes a grounded answer. Two-tier fallback: agent → keyless raw excerpts. Fixed three bugs during rollout: entityType client-side filter that zeroed all results, Organization prefix polluting retrieval queries, duplicate entity chunks dominating top-k. Removed Phase 1 single-shot fallback as dead code.

### Phase 3 — Tuning Env Vars (PR #6)

Exposed all hardcoded agent settings as configurable env vars: `CHAT_AGENT_TOOL_RESULT_LIMIT` (12), `CHAT_AGENT_MAX_SOURCES` (15), `CHAT_AGENT_HISTORY_WINDOW` (6), `CHAT_AGENT_SEARCH_TIER` (classic), `CHAT_AGENT_RETRIEVAL_STRATEGY` (unset). Created `docs/chat-tuning-guide.md` with explanations, recipes, and diagnostic tables.

---

## 2. Phase 4 — Streaming UX + Chat UI Overhaul (current)

### Problem

The agent path takes 10–20s per question (`durationMs: 21454` observed). During that entire time the user sees "Thinking..." with zero feedback. The current SSE protocol chunks the **final** response into 120-char slices after the agent finishes — simulating streaming but delivering no real-time feedback. The chat UI is functional but doesn't feel like a modern conversational interface (ChatGPT-style).

### Goals

1. **Real-time agent activity indicators**: show "Thinking...", "Searching knowledge base...", "Responding..." as the agent progresses through its tool-calling loop.
2. **Token-level streaming** of the final synthesis so the answer appears word-by-word.
3. **ChatGPT-like UI**: adopt the component patterns from [miskibin/chat-components](https://github.com/miskibin/chat-components) — conversational message bubbles, thinking/reasoning collapsible sections, citation pattern handlers, rich input with stop-generation button.
4. **Preserve all existing functionality**: conversations, sources, degraded badge, org switching, RBAC.

### Non-Goals

- No real-time token streaming during the tool-calling loop (only activity indicators). Tokens stream only during final synthesis.
- No `<think>` tag parsing from the LLM (our prompt doesn't generate them). Reserve for later if reasoning models are adopted.
- No message editing or regeneration in this phase (chat-components supports it, but it requires backend changes to re-run the agent loop on edited content).

### Architecture

#### Backend changes (api-velocity)

**Switch `agent.invoke()` to `agent.stream()`** in `chat-agent.service.ts`. The installed langchain v1 `ReactAgent` exposes `.stream()` which returns an `IterableReadableStream` of state updates from each graph node (model call, tool call, etc.). Each chunk contains the messages array with new entries appended.

**New SSE event types** emitted by `chat.controller.ts`:

| Event | When | Payload |
|---|---|---|
| `start` | Request begins | `{ conversation, userMessage }` (unchanged) |
| `thinking` | Agent's first model call starts | `{}` |
| `searching` | Each tool call starts | `{ query: string }` |
| `chunk` | Each token of the final synthesis | `{ content: string }` (one token, not 120-char batch) |
| `complete` | Agent finishes | `{ data: SendChatMessageResponse }` (unchanged) |
| `error` | Any failure | `{ message: string }` (unchanged) |

The controller iterates the agent's stream, inspects each state update to determine which node fired, and emits the corresponding SSE event. Tool-call nodes emit `searching`; the final model-call node's tokens emit `chunk`.

**Fallback**: if streaming fails, fall back to the current `agent.invoke()` + 120-char chunking behavior. The frontend handles both gracefully because it already knows how to process `chunk` events.

#### Frontend changes (spa-velocity)

**Adopt three components** from [miskibin/chat-components](https://github.com/miskibin/chat-components), adapted for our stack:

| Component | Source | Adaptations |
|---|---|---|
| `Message` | `components/message.tsx` | Remove `"use client"` directive. Wire `patternHandlers` for source citations. Add our degraded-mode badge. Keep ReactMarkdown for content. Map `metadata.sources` to citation patterns or keep as a separate section below the message. |
| `GenerationStatus` | `components/generation-status.tsx` | Remove `"use client"`. Add `"searching"` stage detail text showing the actual query (from the new SSE `searching` event payload). Use our existing icon library (@tabler/icons-react) or keep lucide since it's already a dep in spa-velocity. |
| `ChatInput` | `components/chat-input.tsx` | Remove `"use client"`. Wire `onStopGeneration` to abort the SSE fetch. Replace our current `<Input>` + `<Button>` with this richer textarea that auto-grows and has keyboard shortcuts. |

**New SSE event handling** in `chatService.ts`:

```typescript
type ChatStreamEvent =
  | { type: "start"; conversation: ChatConversation; userMessage: ChatMessage }
  | { type: "thinking" }
  | { type: "searching"; query: string }
  | { type: "chunk"; content: string }
  | { type: "complete"; data: SendChatMessageResponse }
  | { type: "error"; message: string };
```

**ChatPage.tsx state changes**:

```typescript
type StreamingState = {
  conversationId: string;
  stage: "thinking" | "searching" | "responding" | "idle";
  searchQuery?: string;   // shown during "searching" stage
  content: string;        // accumulated tokens during "responding"
};
```

The `GenerationStatus` component renders based on `stage`. When a `chunk` event arrives, `stage` transitions to `"responding"` and content accumulates. The `Message` component renders the accumulating content with ReactMarkdown in real time.

### Files to change

#### api-velocity

| File | Change |
|---|---|
| `src/modules/chat/application/services/chat-agent.service.ts` | Add `generateAgentReplyStreaming()` that uses `agent.stream()` instead of `agent.invoke()`. Yield structured events (thinking, searching, chunk) as an async generator. Keep `generateAgentReply()` as fallback. |
| `src/modules/chat/api/controllers/chat.controller.ts` | Refactor `streamMessage` to consume the async generator from the service and emit the new SSE event types. Keep the 120-char chunking as fallback when streaming is not available. |
| `src/modules/chat/application/services/chat.service.ts` | May need a thin adapter to pass through the streaming generator from agent service to controller. |

#### spa-velocity

| File | Change |
|---|---|
| `src/shared/components/ui/message.tsx` | **New** — adapted from chat-components `Message`. |
| `src/shared/components/ui/generation-status.tsx` | **New** — adapted from chat-components `GenerationStatus`. |
| `src/shared/components/ui/chat-input.tsx` | **New** — adapted from chat-components `ChatInput`. |
| `src/features/Chat/types/index.ts` | Add `thinking`, `searching` to `ChatStreamEvent` union. |
| `src/features/Chat/services/chatService.ts` | Handle new SSE event types in `parseStreamResponse`. |
| `src/features/Chat/views/ChatPage.tsx` | Replace inline message rendering with `<Message>` components, replace `<Input>` + `<Button>` with `<ChatInput>`, add `<GenerationStatus>` for streaming state, update streaming state shape. |
| `src/features/Chat/views/ChatPage.test.tsx` | Update tests for new component structure + streaming states. |

### SSE protocol — backward compatibility

The new event types (`thinking`, `searching`) are **additive**. The existing `start`, `chunk`, `complete`, `error` events keep their shape. A frontend that doesn't understand `thinking` or `searching` simply ignores them and sees the same behavior as before (chunks arrive, complete fires). This means:

- The spa-velocity update can ship **before** the api-velocity streaming changes. The new components work with the existing 120-char chunking.
- The api-velocity streaming changes can ship **after** the frontend is ready. When the backend starts emitting `thinking`/`searching` events, the frontend immediately renders them.

This decouples the two PRs and allows independent testing.

### Estimated effort

| Part | Effort |
|---|---|
| Adopt + adapt chat-components into spa-velocity | ~1 day |
| Refactor ChatPage.tsx to use new components | ~half day |
| Update SSE types + chatService.ts parsing | ~2 hours |
| Backend: agent.stream() + new SSE events | ~1 day |
| Tests (frontend component + backend streaming) | ~half day |
| **Total** | **~3 days** |

### Ship order

1. **PR A (spa-velocity)**: Adopt chat-components, refactor ChatPage.tsx, update SSE types. Works with current backend (120-char chunks still render correctly). Visual improvement ships immediately.
2. **PR B (api-velocity)**: Switch to `agent.stream()`, emit `thinking`/`searching`/per-token `chunk` events. When deployed, the frontend automatically picks up the new events and shows activity indicators + real token streaming.

---

## 3. Phase 5 — Full LangGraph + Self-Check (deferred)

Only build if Phase 2's agentic RAG hits a measured quality ceiling (persistent hallucinations, systematically incomplete context). No evidence of this so far.

Key additions over Phase 2: `@langchain/langgraph` dependency, `StateGraph` with explicit nodes, CRAG/Self-RAG self-check pattern, explicit parallel retrieval, LangSmith (required at this complexity level).

---

## 4. Open Questions

1. **Airweave rate limit**: the free tier has a 50-query cap that Phase 2's multi-query agent burns through fast. Upgrading the Airweave plan or adding request-level caching would help.
2. **`agent.stream()` event structure**: need to verify the exact shape of each stream chunk to determine how to distinguish "tool call started" from "model generating tokens" from "model finished". This is a spike task at the start of PR B.
3. **Stop generation**: chat-components' `ChatInput` has `onStopGeneration`. On the backend, this requires aborting the SSE connection and cleaning up the agent's in-flight LLM call. The current controller doesn't handle request cancellation — needs an `AbortController` wired through to the agent.

---

## 5. Decisions Log

| Date | Decision | Context |
|---|---|---|
| 2026-04-08 | OpenAI as LLM provider, `gpt-5.4-nano` default | Cost optimization; user pays personally |
| 2026-04-08 | LangSmith deferred until Phase 3+ | Ship lean, add tooling when measured need |
| 2026-04-09 | Source-agnostic prompt | Agent must handle any indexed content, not just code/PRDs |
| 2026-04-09 | Removed entityType client-side filter | Was zeroing all results; Airweave entity types don't match the fake values |
| 2026-04-09 | Removed Phase 1 single-shot fallback | Dead code; two-tier dispatcher (agent → keyless) is sufficient |
| 2026-04-10 | All agent settings as env vars | Prepares for future UI-based tuning interface |
| 2026-04-10 | Adopt chat-components for Phase 4 | Better UX baseline than custom-building every component; ChatGPT-like feel |
| 2026-04-10 | Phase 4 ships as two decoupled PRs | Frontend visual improvement ships before backend streaming; backward-compatible SSE protocol |
