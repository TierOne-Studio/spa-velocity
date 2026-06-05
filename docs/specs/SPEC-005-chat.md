---
id: SPEC-005
title: "SPEC-005: Chat (conversations, streaming, project-scoped Q&A)"
status: Implemented
layer: ui
owner: Mariano Ravinale
created: 2026-06-04
updated: 2026-06-04
feature_paths:
  - src/features/Chat
related_adrs: []
related_specs: [SPEC-002, SPEC-004, SPEC-006]
counterpart_spec: "api-velocity#SPEC-005"
coordination_doc: ""
---

# SPEC-005: Chat

> **Backfill** — current, test-backed behavior. ACs map to existing tests.

## 1. Summary (intended behavior)

Project-scoped chat: a left rail lists conversations grouped by project; a thread streams assistant
responses over **SSE** with optimistic rendering. Assistant messages render markdown (`react-markdown`
+ `remark-gfm`); user messages render as plain text. Streaming surfaces stages (thinking/searching/
responding), `<think>` reasoning (collapsible), SQL-executed panels, and source links (https-only).
Gated by `chat:read|create|stream|delete`, scoped to the active organization.

## 2. Context & problem

Chat crosses a trust boundary (renders model output + source URLs) and streams over SSE; it was
undocumented. Two security-relevant behaviors are load-bearing: markdown rendering uses React's safe
renderer (no `dangerouslySetInnerHTML`), and source URLs are whitelisted to `https?://` (others render
as text). The LLM/provider config (OpenAI) is the api side's concern (`api-velocity#SPEC-005`).

## 3. Scope

**In scope:** conversation list (grouping, timestamp/preview formatting), create (buffered
first-message flow), SSE streaming (optimistic bubble, chunk accumulation, leak-prevention on nav,
stages), message rendering (markdown/plain/think/SQL/sources), input (send/Enter/Shift+Enter/
whitespace/stop), RBAC gates, error toasts, empty states, switch-project, sources drawer.

**Out of scope / non-goals (unimplemented or unverified — §9):** **HTTP abort of an in-flight stream
(TODO — stop button only clears local state)**; message edit/rename/search/export/attachments
(not implemented); real SSE backend (tests mock the stream).

## 4. Assumptions

1. [Confirmed] Assistant content renders via `react-markdown` (no `dangerouslySetInnerHTML`); user content is plain text (`ChatMessage.test.tsx:43,48`).
2. [Confirmed] Source URLs are rendered as links only when `https?://`; otherwise as spans (`ChatMessage.test.tsx:65,76`).
3. [Confirmed] Message content originates from the trusted backend; the FE does not re-sanitize (XSS risk = LOW given assumptions 1–2).
4. [Confirmed] The stop button does NOT abort the HTTP stream (clears local state only) — known gap (`ChatPage.test.tsx:378`).

## 5. Affected areas

- `src/features/Chat/{views,components,hooks,services,types}/*` — ChatPage, ChatMessage, ChatInput, GenerationStatus, PickProjectDialog, ProjectSourcesDrawer, `useChat`, `chatService`.
- API: `GET/POST /api/chat/conversations`, `GET .../{id}/messages`, `POST .../{id}/messages/stream` (SSE), `DELETE .../{id}` (counterpart `api-velocity#SPEC-005`).

## 6. Acceptance criteria (mapped to existing tests)

| # | Criterion | Proving test |
|---|---|---|
| AC1 | Conversations render grouped by project; org-selection message when no active org | `ChatPage.test.tsx:206,220`; `e2e/chat/chat-with-project.spec.ts:129` |
| AC2 | Create from New button; first message buffers then creates the conversation before sending | `ChatPage.test.tsx:247,279` |
| AC3 | Streaming: optimistic user bubble shown once; chunks accumulate; bubble hidden on nav mid-stream | `ChatPage.test.tsx:571,605,672,706,747` |
| AC4 | Assistant renders markdown; user renders plain text; `<think>` reasoning extracted + toggled | `ChatMessage.test.tsx:43,48,90,98` |
| AC5 | Source URLs: safe `https?://` → link; unsafe → span (XSS guard) | `ChatMessage.test.tsx:65,76` |
| AC6 | SQL panel renders per `sqlCalls` on assistant msgs; never on user msgs | `ChatMessage.test.tsx:203,225` |
| AC7 | Input: send on click/Enter; Shift+Enter newline; whitespace-only blocked; Stop shown while loading | `ChatInput.test.tsx:42,58,66,74,82` |
| AC8 | Generation stages render (thinking/searching±query/responding); nothing when idle | `GenerationStatus.test.tsx:14,19,24,29,34` |
| AC9 | RBAC: no `chat:read` → "Chat unavailable"; no `chat:create` → New disabled | `ChatPage.test.tsx:367,938`; `e2e/chat/chat-permissions-states.spec.ts:33` |
| AC10 | Error toasts on send/create/delete failure | `ChatPage.test.tsx:418,449,468` |
| AC11 | Switch-project opens picker (current badged+disabled) → new conversation under picked project | `ChatPage.test.tsx:995,1015`; `e2e/chat/chat-with-project.spec.ts:175` |
| AC12 | e2e: send a message and receive a streamed response | `e2e/chat/chat-conversations.spec.ts:204` |

## 7. Implementation plan

N/A — backfill. Future chat changes update this spec first (esp. the streaming-abort gap, §9).

## 8. Testing plan

Unit/component under `src/features/Chat/` (some co-located, e.g. `views/ChatPage.test.tsx`, `components/PickProjectDialog.test.tsx`; others under `components/__tests__/`: ChatMessage, ChatInput, GenerationStatus). e2e: `e2e/chat/*`. Run `npx vitest run src/features/Chat`.

## 9. Risks & failure modes

- **Streaming not abortable (HIGH-value gap):** the stop button clears local state but does NOT cancel the HTTP/SSE request (TODO in `ChatPage.tsx`). Cost: wasted tokens/compute after "stop"; the next change here should close it.
- **XSS:** LOW — `react-markdown` safe renderer + https-only source links; relies on the backend not embedding untrusted HTML in `message.content`.
- Streaming integration is mock-tested; real SSE behavior is not e2e-asserted end-to-end.

## 10. Open questions

- Should `api-velocity#SPEC-005` own the SSE event contract (start/thinking/searching/chunk/sql_executed/complete/error) as the SSoT?

## Change Log

- 2026-06-04 · PR (backfill) · created · documents current Chat behavior; 12 ACs mapped to existing component + e2e tests; streaming-abort gap flagged.
