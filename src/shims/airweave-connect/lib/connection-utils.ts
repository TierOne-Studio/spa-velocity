/**
 * Shim — see `./types.ts` for context.
 *
 * The SDK calls these helpers to render its source-connection rows inside
 * the modal. Our SPA owns the source-connection list outside the SDK
 * (`SourceConnectionsList.tsx` with its own `SourceStatusBadge`), so the
 * SDK's internal rendering is the only consumer of these helpers — and
 * generic fallbacks are visually acceptable until upstream publishes the
 * real package.
 */
import type { ConnectionStatus } from './types';

/**
 * Whether the SDK should allow connection initiation for a given source.
 * We permit all — the backend already gates by `airweave:manage-sources`.
 */
export function canConnect(_status: ConnectionStatus | string | undefined): boolean {
  return true;
}

/**
 * CSS color token for a status badge. Returns shadcn-compatible muted
 * tokens; the SDK's own theme prop can override at runtime.
 */
export function getStatusColor(status: ConnectionStatus | string | undefined): string {
  switch (status) {
    case 'connected':
      return 'var(--color-emerald-500, #10b981)';
    case 'connecting':
    case 'pending':
      return 'var(--color-amber-500, #f59e0b)';
    case 'failed':
      return 'var(--color-rose-500, #f43f5e)';
    default:
      return 'var(--color-zinc-400, #a1a1aa)';
  }
}

/** Human label for a status. Returned verbatim if unknown. */
export function getStatusLabel(status: ConnectionStatus | string | undefined): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'unknown':
    case undefined:
    case null:
      return 'Unknown';
    default:
      return String(status);
  }
}
