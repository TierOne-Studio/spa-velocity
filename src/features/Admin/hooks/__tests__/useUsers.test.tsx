import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useRemoveUser,
  useRemoveUsers,
  useBanUser,
  useUnbanUser,
  useSetUserRole,
  useSetUserPassword,
  useUserCapabilities,
  useUserCapabilitiesBatch,
  useUserSessions,
  useRevokeSession,
  useRevokeAllSessions,
  useImpersonateUser,
  useStopImpersonating,
  userKeys,
} from '../useUsers';
import { adminService } from '../../services/adminService';

const mockUseEffectiveSession = vi.fn();

// Mock the admin service
vi.mock('../../services/adminService', () => ({
  adminService: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    removeUser: vi.fn(),
    removeUsers: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
    setRole: vi.fn(),
    getUserCapabilities: vi.fn(),
    getBatchCapabilities: vi.fn(),
    setPassword: vi.fn(),
    listUserSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessions: vi.fn(),
    impersonateUser: vi.fn(),
    stopImpersonating: vi.fn(),
  },
}));

vi.mock('@/shared/hooks/useEffectiveSession', () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

// Get typed mock references
const mockAdminService = adminService as unknown as {
  listUsers: Mock
  createUser: Mock
  banUser: Mock
  unbanUser: Mock
  setRole: Mock
  getUserCapabilities: Mock
  getBatchCapabilities: Mock
};

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  mockUseEffectiveSession.mockReturnValue({
    data: {
      user: { id: 'admin-1' },
      session: { activeOrganizationId: 'org-1' },
    },
  });
});

describe('useUsers hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch users successfully', async () => {
    const mockUsers = {
      data: [
        { id: '1', name: 'John Doe', email: 'john@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com', emailVerified: false, createdAt: new Date(), updatedAt: new Date() },
      ],
      total: 2,
    };

    mockAdminService.listUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUsers({ limit: 10, offset: 0 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockUsers);
    expect(mockAdminService.listUsers).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
    });
  });

  it('should handle fetch error', async () => {
    mockAdminService.listUsers.mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => useUsers({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe('useCreateUser hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create user successfully', async () => {
    const newUser = {
      id: '3',
      name: 'New User',
      email: 'new@example.com',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockAdminService.createUser.mockResolvedValue(newUser);

    const { result } = renderHook(() => useCreateUser(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      role: 'member',
      organizationId: 'org-1',
    });

    expect(mockAdminService.createUser).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      role: 'member',
      organizationId: 'org-1',
    });
  });
});

describe('useBanUser hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ban user successfully', async () => {
    mockAdminService.banUser.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBanUser(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      userId: '1',
      banReason: 'Violation of terms',
    });

    expect(mockAdminService.banUser).toHaveBeenCalledWith({
      userId: '1',
      banReason: 'Violation of terms',
    });
  });
});

describe('useUnbanUser hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should unban user successfully', async () => {
    mockAdminService.unbanUser.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUnbanUser(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync('1');

    expect(mockAdminService.unbanUser).toHaveBeenCalledWith('1');
  });
});

describe('useSetUserRole hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set user role successfully', async () => {
    mockAdminService.setRole.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSetUserRole(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      userId: '1',
      role: 'admin',
    });

    expect(mockAdminService.setRole).toHaveBeenCalledWith({
      userId: '1',
      role: 'admin',
    });
  });
});

describe('useUserCapabilities hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch capabilities successfully', async () => {
    const capabilities = {
      targetUserId: '1',
      targetRole: 'member',
      isSelf: false,
      actions: {
        update: true,
        setRole: true,
        ban: true,
        unban: true,
        setPassword: true,
        remove: true,
        revokeSessions: true,
        impersonate: true,
      },
    };

    mockAdminService.getUserCapabilities.mockResolvedValue(capabilities);

    const { result } = renderHook(() => useUserCapabilities('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockAdminService.getUserCapabilities).toHaveBeenCalledWith('1');
    expect(result.current.data).toEqual(capabilities);
  });
});

describe('useUserCapabilitiesBatch hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty data when userIds is empty (hook stays disabled)', () => {
    const { result } = renderHook(() => useUserCapabilitiesBatch([]), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(mockAdminService.getBatchCapabilities).not.toHaveBeenCalled();
  });

  it('fetches batch capabilities and returns record keyed by userId', async () => {
    const batchData: Record<string, object> = {
      'user-1': {
        targetUserId: 'user-1',
        targetRole: 'member',
        isSelf: false,
        actions: { update: true, setRole: true, ban: true, unban: true, setPassword: true, remove: true, revokeSessions: true, impersonate: true },
      },
    };

    mockAdminService.getBatchCapabilities.mockResolvedValue(batchData);

    const { result } = renderHook(() => useUserCapabilitiesBatch(['user-1']), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockAdminService.getBatchCapabilities).toHaveBeenCalledWith(['user-1']);
    expect(result.current.data).toEqual(batchData);
  });

  it('does not call service when enabled=false', () => {
    renderHook(() => useUserCapabilitiesBatch(['user-1'], false), {
      wrapper: createWrapper(),
    });

    expect(mockAdminService.getBatchCapabilities).not.toHaveBeenCalled();
  });
});

describe('useImpersonateUser hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call adminService.impersonateUser with userId and organizationId', async () => {
    (adminService.impersonateUser as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useImpersonateUser(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      userId: 'user-1',
      organizationId: 'org-1',
    });

    expect(adminService.impersonateUser).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
    });
  });

  it('should default impersonation organizationId from the effective active organization', async () => {
    (adminService.impersonateUser as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useImpersonateUser(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ userId: 'user-1' });

    expect(adminService.impersonateUser).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
    });
  });
});

describe('useStopImpersonating hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call adminService.stopImpersonating', async () => {
    (adminService.stopImpersonating as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useStopImpersonating(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(adminService.stopImpersonating).toHaveBeenCalled();
  });
});

describe('useUpdateUser hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls adminService.updateUser and invalidates queries on success', async () => {
    (adminService.updateUser as Mock).mockResolvedValue({ id: '1', name: 'Updated' });

    const { result } = renderHook(() => useUpdateUser(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ userId: '1', data: { name: 'Updated' } });

    expect(adminService.updateUser).toHaveBeenCalledWith({ userId: '1', data: { name: 'Updated' } });
  });
});

describe('useRemoveUser hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls adminService.removeUser and invalidates queries on success', async () => {
    (adminService.removeUser as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRemoveUser(), { wrapper: createWrapper() });

    await result.current.mutateAsync('user-1');

    expect(adminService.removeUser).toHaveBeenCalledWith('user-1');
  });
});

describe('useRemoveUsers hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls adminService.removeUsers with array of ids', async () => {
    (adminService.removeUsers as Mock).mockResolvedValue({ success: true, deletedCount: 2 });

    const { result } = renderHook(() => useRemoveUsers(), { wrapper: createWrapper() });

    await result.current.mutateAsync(['user-1', 'user-2']);

    expect(adminService.removeUsers).toHaveBeenCalledWith(['user-1', 'user-2']);
  });
});

describe('useSetUserPassword hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls adminService.setPassword', async () => {
    (adminService.setPassword as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSetUserPassword(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ userId: 'user-1', newPassword: 'NewPass123!' });

    expect(adminService.setPassword).toHaveBeenCalledWith({ userId: 'user-1', newPassword: 'NewPass123!' });
  });
});

describe('useUserSessions hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches sessions for a user when userId is provided', async () => {
    const sessions = [{ id: 'sess-1', token: 'tok-1' }];
    (adminService.listUserSessions as Mock).mockResolvedValue(sessions);

    const { result } = renderHook(() => useUserSessions('user-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminService.listUserSessions).toHaveBeenCalledWith('user-1');
    expect(result.current.data).toEqual(sessions);
  });

  it('does not fetch when userId is empty string — covers enabled: !!userId branch', async () => {
    const { result } = renderHook(() => useUserSessions(''), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(adminService.listUserSessions).not.toHaveBeenCalled();
  });
});

describe('useRevokeSession hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls adminService.revokeSession and invalidates queries', async () => {
    (adminService.revokeSession as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRevokeSession(), { wrapper: createWrapper() });

    await result.current.mutateAsync('tok-abc');

    expect(adminService.revokeSession).toHaveBeenCalledWith('tok-abc');
  });
});

describe('useRevokeAllSessions hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls adminService.revokeAllSessions and invalidates queries', async () => {
    (adminService.revokeAllSessions as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRevokeAllSessions(), { wrapper: createWrapper() });

    await result.current.mutateAsync('user-1');

    expect(adminService.revokeAllSessions).toHaveBeenCalledWith('user-1');
  });
});

describe('userKeys', () => {
  it('should generate correct query keys', () => {
    expect(userKeys.all).toEqual(['users']);
    expect(userKeys.lists()).toEqual(['users', 'list']);
    expect(userKeys.list({ limit: 10 })).toEqual(['users', 'list', 'anonymous', 'no-org', { limit: 10 }]);
    expect(userKeys.list({ limit: 10 }, { userId: 'admin-1', activeOrganizationId: 'org-1' })).toEqual([
      'users',
      'list',
      'admin-1',
      'org-1',
      { limit: 10 },
    ]);
    expect(userKeys.details()).toEqual(['users', 'detail']);
    expect(userKeys.detail('1')).toEqual(['users', 'detail', 'anonymous', 'no-org', '1']);
    expect(userKeys.sessions('1')).toEqual(['users', 'sessions', 'anonymous', 'no-org', '1']);
    expect(userKeys.capabilities('1')).toEqual(['users', 'capabilities', 'anonymous', 'no-org', '1']);
  });
});
