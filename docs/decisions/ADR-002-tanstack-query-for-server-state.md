# ADR-002: TanStack Query for server state

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** Engineering

## Context

Server data has different needs from client state: caching, deduplication, revalidation, optimistic updates, request cancellation, retry policy, paginated/infinite queries. Using `useEffect(() => fetch(...))` plus `useState` to manage server data forces the team to reimplement all of the above and produces fragile code that drifts.

Constraints:
- Authenticated API calls go through better-auth or axios.
- Multiple features need the same data with different keys (org list, user list, projects).
- Cancellation must cascade — when a route unmounts, in-flight queries abort.
- The cache is the source of truth; client store must NOT mirror.

Visible in: [`src/features/Chat/hooks/useChat.ts`](../../src/features/Chat/hooks/useChat.ts) (`chatKeys` namespacing pattern), [`src/features/Projects/hooks/useProjects.ts`](../../src/features/Projects/hooks/useProjects.ts).

## Decision

We use **[TanStack Query](https://tanstack.com/query/latest) (`@tanstack/react-query`) 5** for all server state. Every fetch goes through a `useQuery` or `useMutation` wrapped in a feature-private named hook (`useChatConversations`, `useProjects`). Query keys follow the hierarchical-namespaced pattern:

```ts
export const chatKeys = {
  all: ['chat'] as const,
  conversations: (userId: string) => [...chatKeys.all, 'conversations', userId] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
}
```

Mutations invalidate the relevant keys via `queryClient.invalidateQueries({ queryKey: ... })`. Errors surface via the query's `error` field — no client-side retry loops outside TanStack Query's `retry` config (set `retry: false` for non-idempotent mutations).

## Alternatives considered

- **SWR** — lighter, by Vercel. Similar primitives. Rejected because TanStack Query has richer mutation/cache-invalidation API and the team has existing experience.
- **Apollo Client** — only relevant if we adopt GraphQL. Rejected because the API is REST.
- **RTK Query** — only relevant if Redux Toolkit were already in use. Rejected because we use Zustand (ADR-001).
- **Plain `useEffect` + `useState`** — viable but reimplements caching, dedup, cancellation. Rejected for maintenance cost.

## Consequences

- **Positive:** caching, dedup, request cancellation via `signal`, optimistic updates, paginated queries, devtools, mature error/loading state surfacing.
- **Negative:** non-trivial learning curve for query-key conventions and cache-invalidation choreography. Footgun: stale data if invalidation key doesn't match.
- **Follow-ups:** if a feature pattern emerges where `select` (data transform) is used heavily, codify it in `react-data-fetching` skill.

## References

- [`src/features/Chat/hooks/useChat.ts`](../../src/features/Chat/hooks/useChat.ts) — `chatKeys` namespacing pattern.
- [`src/features/Projects/hooks/useProjects.ts`](../../src/features/Projects/hooks/useProjects.ts).
- [`react-data-fetching`](../../.ruler/skills/react-data-fetching/SKILL.md) — TanStack Query patterns.
- [`repo-conventions`](../../.ruler/skills/repo-conventions/SKILL.md) § TanStack Query conventions.
