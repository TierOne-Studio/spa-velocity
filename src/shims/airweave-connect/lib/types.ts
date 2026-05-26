/**
 * Shim for the unpublished upstream `airweave-connect` workspace package.
 *
 * Background: `@airweave/connect-react@0.9.62` (and every prior version
 * back to 0.9.44) declares `"airweave-connect": "file:../.."` in its
 * package.json — a monorepo workspace link that was never published to
 * npm. Vite / esbuild cannot resolve the import; the dev server crashes
 * before our routes even mount.
 *
 * This shim file (and its three siblings under `src/shims/airweave-connect/lib/`)
 * provides minimal but functional implementations of the symbols the SDK
 * actually consumes, wired in via a Vite + Vitest alias. The OAuth
 * postMessage handshake itself runs against `connect.airweave.ai` and
 * does NOT depend on any of these helpers — they only affect UI affordances
 * inside the iframe modal chrome (status badges, app icons, default colors).
 *
 * When Airweave fixes their publish pipeline, delete this directory and
 * the corresponding aliases in `vite.config.ts` / `vitest.config.ts`.
 *
 * @see https://github.com/airweave-ai/airweave (file upstream issue)
 */

/** App icon variants the SDK requests per source (e.g. "slack"). */
export type IconVariant = 'default' | 'light' | 'dark';

/** Theme colors consumed by the SDK iframe wrapper. */
export interface ConnectTheme {
  colors?: Partial<{
    background: string;
    foreground: string;
    primary: string;
    accent: string;
    border: string;
    muted: string;
  }>;
  labels?: Partial<Record<string, string>>;
  options?: Partial<{
    borderRadius: string;
    fontFamily: string;
  }>;
}

/** Views the SDK can navigate to when the modal is open. */
export type NavigateView = 'sources' | 'connections' | 'settings' | string;

/** Error shape the SDK passes to `onError`. */
export interface SessionError {
  message: string;
  code?: string;
}

/** Session status the SDK reports via `onStatusChange`. */
export type SessionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'connected'
  | 'cancelled'
  | 'error';

/** Connection status the SDK renders per source row. */
export type ConnectionStatus =
  | 'pending'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'unknown';
