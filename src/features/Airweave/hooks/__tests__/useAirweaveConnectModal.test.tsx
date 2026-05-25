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

import { useAirweaveConnectModal } from '../useAirweaveConnectModal';
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
          collectionReadableId: 'acme-x-deadbeef',
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
          collectionReadableId: 'acme-x-deadbeef',
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
          collectionReadableId: 'acme-x-deadbeef',
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
          collectionReadableId: 'acme-x-deadbeef',
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
          collectionReadableId: 'acme-x-deadbeef',
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
          collectionReadableId: 'acme-x-deadbeef',
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
          collectionReadableId: 'acme-x-deadbeef',
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
          collectionReadableId: 'acme-x-deadbeef',
        }),
      { wrapper: Wrapper },
    );

    expect(captureProps.current?.connectUrl).toBeUndefined();
  });
});
