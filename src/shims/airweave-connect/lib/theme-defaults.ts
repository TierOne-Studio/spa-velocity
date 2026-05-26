/**
 * Shim — see `./types.ts` for context.
 *
 * Theme defaults consumed by the SDK iframe wrapper. The SDK lets the
 * consumer pass a `theme` prop; if omitted, the SDK falls back to these
 * defaults. We pick values that read cleanly against both shadcn light
 * and dark surfaces.
 */
import type { ConnectTheme } from './types';

export const defaultLightColors: NonNullable<ConnectTheme['colors']> = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  primary: '#18181b',
  accent: '#2563eb',
  border: '#e4e4e7',
  muted: '#f4f4f5',
};

export const defaultDarkColors: NonNullable<ConnectTheme['colors']> = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  primary: '#fafafa',
  accent: '#3b82f6',
  border: '#27272a',
  muted: '#18181b',
};

export const defaultLabels: NonNullable<ConnectTheme['labels']> = {
  // Used in error/empty states inside the SDK modal. Strings are user-visible.
  modalTitle: 'Connect your apps',
  modalSubtitle: 'Choose a source to authenticate.',
  loading: 'Loading…',
  cancel: 'Cancel',
  retry: 'Retry',
  back: 'Back',
  close: 'Close',
  noSourcesAvailable: 'No sources available.',
  errorTitle: 'Something went wrong',
  errorBody: 'Please close and try again. If the issue persists, contact support.',
};

export const defaultOptions: NonNullable<ConnectTheme['options']> = {
  borderRadius: '0.5rem',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};
