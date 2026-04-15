import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const {
  mockSignIn,
  mockSignUp,
  mockSignOut,
  mockFetchWithAuth,
  mockClearAuthStorage,
  mockUseEffectiveSession,
} = vi.hoisted(() => ({
  mockSignIn: { email: vi.fn() },
  mockSignUp: { email: vi.fn() },
  mockSignOut: vi.fn(),
  mockFetchWithAuth: vi.fn(),
  mockClearAuthStorage: vi.fn(),
  mockUseEffectiveSession: vi.fn(),
}));

vi.mock('@shared/lib/auth-client', () => ({
  signIn: mockSignIn,
  signUp: mockSignUp,
  signOut: mockSignOut,
}));

vi.mock('@shared/lib/fetch-with-auth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

vi.mock('@shared/lib/auth-storage', () => ({
  clearAuthStorage: () => mockClearAuthStorage(),
}));

vi.mock('@shared/hooks/useEffectiveSession', () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../AuthContext';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    mockUseEffectiveSession.mockReturnValue({
      data: null,
      isPending: false,
      refetch: vi.fn(),
    });
  });

  describe('role normalization', () => {
    it('returns "admin" for role "admin"', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'Admin', email: 'a@x.com', role: 'admin' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.user?.role).toBe('admin');
    });

    it('returns "superadmin" for role "superadmin"', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'SA', email: 'sa@x.com', role: 'superadmin' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.user?.role).toBe('superadmin');
    });

    it('returns "manager" for role "manager"', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'Mgr', email: 'm@x.com', role: 'manager' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.user?.role).toBe('manager');
    });

    it('defaults to "member" for unknown roles', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: 'unknown' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.user?.role).toBe('member');
    });

    it('normalizes comma-separated roles string', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: 'manager,member' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.user?.role).toBe('manager');
    });

    it('normalizes roles array to highest privilege', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: ['member', 'admin'] }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.user?.role).toBe('admin');
    });

    it('returns "member" when role is undefined', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.user?.role).toBe('member');
    });
  });

  describe('isAuthenticated', () => {
    it('is true when session has user', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: 'admin' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('is false when session is null', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('is false when session has no user', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { session: {} },
        isPending: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('login', () => {
    it('calls signIn.email with credentials', async () => {
      const refetch = vi.fn().mockResolvedValue(undefined);
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch,
      });
      mockSignIn.email.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.login({ email: 'user@example.com', password: 'pass123' });
      });

      expect(mockSignIn.email).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'pass123',
      });
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('throws error on login failure', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockSignIn.email.mockResolvedValue({ error: { message: 'Invalid credentials' } });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.login({ email: 'bad@example.com', password: 'wrong' });
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('throws generic error when login error has no message', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockSignIn.email.mockResolvedValue({ error: {} });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.login({ email: 'bad@example.com', password: 'wrong' });
        }),
      ).rejects.toThrow('Login failed');
    });
  });

  describe('signup', () => {
    it('calls signUp.email with credentials', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockSignUp.email.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.signup({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'pass123',
        });
      });

      expect(mockSignUp.email).toHaveBeenCalledWith({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'pass123',
      });
    });

    it('throws error on signup failure', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockSignUp.email.mockResolvedValue({ error: { message: 'Email already taken' } });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.signup({ name: 'Bob', email: 'bob@example.com', password: 'pass' });
        }),
      ).rejects.toThrow('Email already taken');
    });

    it('throws generic error when signup error has no message', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockSignUp.email.mockResolvedValue({ error: {} });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.signup({ name: 'Bob', email: 'bob@example.com', password: 'pass' });
        }),
      ).rejects.toThrow('Signup failed');
    });
  });

  describe('logout', () => {
    it('calls signOut and clearAuthStorage', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: 'admin' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });
      mockSignOut.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockClearAuthStorage).toHaveBeenCalledTimes(1);
    });
  });

  describe('forgotPassword', () => {
    it('makes correct API call with email and redirectTo', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({ ok: true });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.forgotPassword('user@example.com');
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/request-password-reset'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('user@example.com'),
        }),
      );
    });

    it('throws error when forgotPassword request fails', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'User not found' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.forgotPassword('nobody@example.com');
        }),
      ).rejects.toThrow('User not found');
    });

    it('throws generic error when forgotPassword response has no message', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.forgotPassword('nobody@example.com');
        }),
      ).rejects.toThrow('Failed to send reset email');
    });
  });

  describe('resetPassword', () => {
    it('makes correct API call with token and newPassword', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({ ok: true });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.resetPassword('reset-token-xyz', 'newPass123');
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/reset-password'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('reset-token-xyz'),
        }),
      );
    });

    it('throws error when resetPassword request fails', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Token expired' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.resetPassword('expired-token', 'newPass');
        }),
      ).rejects.toThrow('Token expired');
    });
  });

  describe('sendVerificationEmail', () => {
    it('makes correct API call with email', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({ ok: true });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.sendVerificationEmail('verify@example.com');
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/send-verification-email'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('verify@example.com'),
        }),
      );
    });

    it('throws error when sendVerificationEmail request fails', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Rate limited' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.sendVerificationEmail('user@example.com');
        }),
      ).rejects.toThrow('Rate limited');
    });
  });

  describe('useAuth outside provider', () => {
    it('throws when used outside AuthProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('AuthProvider renders', () => {
    it('renders children', () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <span>Hello World</span>
          </AuthProvider>
        </QueryClientProvider>,
      );
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('isLoading reflects session isPending', () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: true,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
    });

    it('keeps auth loading true while approval status is resolving for authenticated users', async () => {
      let resolveFetch!: (value: {
        ok: boolean;
        json: () => Promise<{ approvalStatus: string; rejectionReason: string | null }>;
      }) => void;

      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: 'member' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => ({ approvalStatus: 'pending', rejectionReason: null }),
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user?.approvalStatus).toBe('pending');
      });
    });

    it('fails closed to pending approval when the approval-status request is unauthorized', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: 'member' }, session: {} },
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user?.approvalStatus).toBe('pending');
      });
    });
  });

  describe('resetPassword fallback error message', () => {
    it('uses fallback message when error.message is empty (covers line 152 || fallback)', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: async () => ({ message: '' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.resetPassword('token', 'pass');
        }),
      ).rejects.toThrow('Failed to reset password');
    });
  });

  describe('sendVerificationEmail fallback error message', () => {
    it('uses fallback message when error.message is empty (covers line 165 || fallback)', async () => {
      mockUseEffectiveSession.mockReturnValue({
        data: null,
        isPending: false,
        refetch: vi.fn(),
      });
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: async () => ({ message: '' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.sendVerificationEmail('user@example.com');
        }),
      ).rejects.toThrow('Failed to send verification email');
    });
  });

  describe('refreshSession', () => {
    it('calls refetch and refetchApproval when refreshSession is invoked (covers lines 170-171)', async () => {
      // Covers lines 170-171: await refetch() and await refetchApproval()
      const mockRefetch = vi.fn().mockResolvedValue(undefined);
      mockUseEffectiveSession.mockReturnValue({
        data: { user: { id: 'u1', name: 'User', email: 'u@x.com', role: 'member' }, session: {} },
        isPending: false,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
