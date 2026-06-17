import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── SDK mock (must be hoisted so the wrapper picks it up at import time) ─

const { mockUseAirweaveConnect, captureProps } = vi.hoisted(() => {
  return {
    captureProps: { current: null as null | Record<string, unknown> },
    mockUseAirweaveConnect: vi.fn(),
  };
});

vi.mock('@airweave/connect-react', () => ({
  useAirweaveConnect: (opts: Record<string, unknown>) => {
    captureProps.current = opts;
    return mockUseAirweaveConnect(opts);
  },
}));

const { mockToastSuccess, mockToastError, mockToastMessage } = vi.hoisted(
  () => ({
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockToastMessage: vi.fn(),
  }),
);
vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    message: mockToastMessage,
  },
}));

import {
  useAirweaveConnectModal,
  validateConnectUrl,
} from '../useAirweaveConnectModal';
import { airweaveKeys } from '../airweaveKeys';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

beforeEach(() => {
  captureProps.current = null;
  mockUseAirweaveConnect.mockReset();
  mockUseAirweaveConnect.mockReturnValue({ open: vi.fn(), isLoading: false });
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockToastMessage.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('useAirweaveConnectModal', () => {
  const getSessionToken = vi.fn().mockResolvedValue('tok-abc');

  it('forwards `open` from the SDK', () => {
    const sdkOpen = vi.fn();
    mockUseAirweaveConnect.mockReturnValue({ open: sdkOpen, isLoading: false });
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    result.current.open();
    expect(sdkOpen).toHaveBeenCalledTimes(1);
  });

  it('wires `getSessionToken` straight through to the SDK', () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    expect(captureProps.current?.getSessionToken).toBe(getSessionToken);
  });

  it('on simulated onSuccess: invalidates sourceConnections AND detail keys, fires success toast, calls onConnected', () => {
    const onConnected = vi.fn();
    const { queryClient, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
          onConnected,
        }),
      { wrapper: Wrapper },
    );

    const sdkProps = captureProps.current as {
      onSuccess: (id: string) => void;
    };
    sdkProps.onSuccess('conn-1');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.sourceConnections('acme-x-deadbeef'),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.detail('acme-x-deadbeef'),
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Source connection authenticated.',
    );
    expect(onConnected).toHaveBeenCalledWith('conn-1');
  });

  it('on simulated onError: toast message is scrubbed of session_token leakage', () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    const sdkProps = captureProps.current as {
      onError: (error: { message: string }) => void;
    };
    sdkProps.onError({
      message: 'upstream rejected ?session_token=AAAAAA stub',
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'upstream rejected ?session_token=[REDACTED] stub',
    );
  });

  it('NEGATIVE PATH (Path B fail-loud): when getSessionToken throws "No pending OAuth token", SDK forwards to onError and wrapper surfaces the scrubbed message via toast', async () => {
    // Symmetric to the page-level happy-path test in Step 5. Pins the
    // contract that the wrapper does NOT swallow getSessionToken errors
    // — they flow through SDK onError → toast, and the user is told to
    // click Reauth on the row.
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken: async () => {
            throw new Error(
              'No pending OAuth token — click Reauth on the row to retry.',
            );
          },
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    const sdkProps = captureProps.current as {
      onError: (error: { message: string }) => void;
    };
    // The SDK in production catches the rejected getSessionToken and
    // forwards via onError; we simulate that path here.
    sdkProps.onError({
      message: 'No pending OAuth token — click Reauth on the row to retry.',
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'No pending OAuth token — click Reauth on the row to retry.',
    );
  });

  it("on onClose('cancel'): fires cancel toast, calls onCancelled, does NOT invalidate cache", () => {
    const onCancelled = vi.fn();
    const { queryClient, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
          onCancelled,
        }),
      { wrapper: Wrapper },
    );

    const sdkProps = captureProps.current as {
      onClose: (reason: 'success' | 'cancel' | 'error') => void;
    };
    sdkProps.onClose('cancel');

    expect(mockToastMessage).toHaveBeenCalledWith(
      'Source created in pending state — complete OAuth later via Reauth on the row, or delete the row.',
    );
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("on onClose('success'|'error'): no toast (handled by onSuccess/onError respectively)", () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    const sdkProps = captureProps.current as {
      onClose: (reason: 'success' | 'cancel' | 'error') => void;
    };
    sdkProps.onClose('success');
    sdkProps.onClose('error');

    expect(mockToastMessage).not.toHaveBeenCalled();
    // (success/error toasts come from handleSuccess/handleError, which
    // we don't fire here.)
  });

  it('VITE_AIRWEAVE_CONNECT_URL unset → wrapper passes undefined → SDK uses default', () => {
    // .env.test does NOT set VITE_AIRWEAVE_CONNECT_URL.
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    expect(captureProps.current?.connectUrl).toBeUndefined();
  });

  it('SDK is invoked with showCloseButton: true (a11y mitigation — keyboard close affordance)', () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );
    expect(captureProps.current?.showCloseButton).toBe(true);
  });

  // ── theme prop (ADR-011 § Amendment 4 follow-up) ─────────────────────

  it("forwards theme: 'dark' to the SDK as { mode: 'dark' } so iframe URL gets ?theme=dark", () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
          theme: 'dark',
        }),
      { wrapper: Wrapper },
    );
    expect(captureProps.current?.theme).toEqual({ mode: 'dark' });
  });

  it("forwards theme: 'light' to the SDK as { mode: 'light' }", () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
          theme: 'light',
        }),
      { wrapper: Wrapper },
    );
    expect(captureProps.current?.theme).toEqual({ mode: 'light' });
  });

  it('omits theme prop entirely when caller does not pass one (preserves SDK default)', () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken,
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );
    expect(captureProps.current?.theme).toBeUndefined();
  });
});

// ── validateConnectUrl (security MED #1 remediation) ─────────────────────

describe('validateConnectUrl', () => {
  it('returns undefined for undefined input (env-var unset is valid; SDK uses default)', () => {
    expect(validateConnectUrl(undefined)).toBeUndefined();
  });

  it('accepts https:// URLs (the production case)', () => {
    expect(validateConnectUrl('https://connect.airweave.ai')).toBe(
      'https://connect.airweave.ai',
    );
    expect(validateConnectUrl('https://self-hosted.example.com/connect')).toBe(
      'https://self-hosted.example.com/connect',
    );
  });

  it('accepts http://localhost (dev only — port and path do not matter)', () => {
    expect(validateConnectUrl('http://localhost')).toBe('http://localhost');
    expect(validateConnectUrl('http://localhost:8080')).toBe(
      'http://localhost:8080',
    );
    expect(validateConnectUrl('http://localhost:3000/widget')).toBe(
      'http://localhost:3000/widget',
    );
  });

  it('REJECTS http:// to non-localhost (would silently weaken postMessage origin pin)', () => {
    expect(() => validateConnectUrl('http://attacker.example')).toThrow(
      /must be https:\/\/.*got: http:\/\/attacker\.example/,
    );
    expect(() =>
      validateConnectUrl('http://connect.airweave.ai'),
    ).toThrow(/must be https:\/\//);
  });

  it('REJECTS non-http(s) protocols (file://, ftp://, javascript:)', () => {
    expect(() => validateConnectUrl('file:///etc/passwd')).toThrow(
      /must be https:\/\//,
    );
    expect(() => validateConnectUrl('ftp://example.com')).toThrow(
      /must be https:\/\//,
    );
  });

  it('REJECTS malformed URLs with a clear "not a valid URL" message', () => {
    expect(() => validateConnectUrl('not-a-url')).toThrow(
      /is not a valid URL: 'not-a-url'/,
    );
    expect(() => validateConnectUrl('://broken')).toThrow(
      /is not a valid URL/,
    );
  });
});

// ── Focus capture + RAF restore (a11y HIGH remediation) ──────────────────

describe('useAirweaveConnectModal — focus capture + restore', () => {
  // RAF doesn't fire in jsdom by default; we synchronously invoke the
  // callback to simulate the next frame.
  let rafSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      ((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      }) as typeof window.requestAnimationFrame,
    );
  });
  afterEach(() => rafSpy.mockRestore());

  function focusButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = 'trigger';
    document.body.appendChild(btn);
    btn.focus();
    return btn;
  }

  it('open() snapshots document.activeElement as the focus-restore target', () => {
    const sdkOpen = vi.fn();
    mockUseAirweaveConnect.mockReturnValue({ open: sdkOpen, isLoading: false });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken: vi.fn().mockResolvedValue('tok'),
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    const btn = focusButton();
    expect(document.activeElement).toBe(btn);

    result.current.open();
    expect(sdkOpen).toHaveBeenCalledTimes(1);

    // Now simulate the SDK firing onSuccess → restoreFocus → RAF → .focus()
    const focusSpy = vi.spyOn(btn, 'focus');
    const sdkProps = captureProps.current as {
      onSuccess: (id: string) => void;
    };
    sdkProps.onSuccess('conn-1');

    expect(rafSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalledTimes(1);

    btn.remove();
  });

  it('onError restores focus to the captured trigger', () => {
    mockUseAirweaveConnect.mockReturnValue({
      open: vi.fn(),
      isLoading: false,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken: vi.fn().mockResolvedValue('tok'),
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    const btn = focusButton();
    result.current.open();
    const focusSpy = vi.spyOn(btn, 'focus');

    const sdkProps = captureProps.current as {
      onError: (e: { message: string }) => void;
    };
    sdkProps.onError({ message: 'something failed' });

    expect(focusSpy).toHaveBeenCalledTimes(1);
    btn.remove();
  });

  it("onClose('cancel') restores focus to the captured trigger", () => {
    mockUseAirweaveConnect.mockReturnValue({
      open: vi.fn(),
      isLoading: false,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken: vi.fn().mockResolvedValue('tok'),
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    const btn = focusButton();
    result.current.open();
    const focusSpy = vi.spyOn(btn, 'focus');

    const sdkProps = captureProps.current as {
      onClose: (reason: 'success' | 'cancel' | 'error') => void;
    };
    sdkProps.onClose('cancel');

    expect(focusSpy).toHaveBeenCalledTimes(1);
    btn.remove();
  });

  it("onClose('success' | 'error') does NOT double-restore (handled by onSuccess/onError)", () => {
    mockUseAirweaveConnect.mockReturnValue({
      open: vi.fn(),
      isLoading: false,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useAirweaveConnectModal({
          getSessionToken: vi.fn().mockResolvedValue('tok'),
          airweaveCollectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    const btn = focusButton();
    result.current.open();
    const focusSpy = vi.spyOn(btn, 'focus');

    const sdkProps = captureProps.current as {
      onClose: (reason: 'success' | 'cancel' | 'error') => void;
    };
    sdkProps.onClose('success');
    sdkProps.onClose('error');

    expect(focusSpy).not.toHaveBeenCalled();
    btn.remove();
  });
});
