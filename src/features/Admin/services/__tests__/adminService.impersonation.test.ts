import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
    mockFetchWithAuth,
} = vi.hoisted(() => ({
    mockFetchWithAuth: vi.fn(),
}));

vi.mock('@shared/lib/auth-client', () => ({
    admin: {},
    organization: {},
}));

vi.mock('@shared/lib/fetch-with-auth', () => ({
    fetchWithAuth: mockFetchWithAuth,
    fetchApi: async (url: string, options?: RequestInit, fallbackMessage = "Request failed") => {
        const response = await mockFetchWithAuth(...[url, options].filter(v => v !== undefined));
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || fallbackMessage);
        }
        if (response.status === 204) return undefined;
        return response.json();
    },
}));

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        _getStore: () => store,
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import { adminService } from '../adminService';

describe('adminService.impersonateUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
    });

    describe('unified custom start flow', () => {
        it('should call unified admin/users impersonation endpoint without role metadata', async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionToken: 'new-session-token' }),
            });

            await adminService.impersonateUser('user-1');

            expect(mockFetchWithAuth).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/users/user-1/impersonate'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({}),
                }),
            );
        });

        it('should preserve original bearer token and store custom impersonation metadata for admin', async () => {
            localStorageMock.setItem('bearer_token', 'original-admin-token');
            vi.clearAllMocks();
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionToken: 'new-admin-session-token' }),
            });

            await adminService.impersonateUser('user-1');

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'original_bearer_token',
                'original-admin-token',
            );
            expect(localStorageMock.setItem).toHaveBeenCalledWith('bearer_token', 'new-admin-session-token');
            expect(localStorageMock.setItem).toHaveBeenCalledWith('impersonation_mode', 'custom');
        });

        it('should omit organizationId when no options provided', async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionToken: 'new-session-token' }),
            });

            await adminService.impersonateUser('user-1');

            expect(mockFetchWithAuth).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/users/user-1/impersonate'),
                expect.objectContaining({ method: 'POST' }),
            );
        });

        it('should include organizationId when provided', async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionToken: 'mgr-session-token' }),
            });

            await adminService.impersonateUser('user-1', {
                organizationId: 'org-1',
            });

            expect(mockFetchWithAuth).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/users/user-1/impersonate'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ organizationId: 'org-1' }),
                }),
            );
        });

        it('should allow backend org resolution when organizationId is omitted', async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionToken: 'new-session-token' }),
            });

            await adminService.impersonateUser('user-1');

            expect(mockFetchWithAuth).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/users/user-1/impersonate'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({}),
                }),
            );
        });

        it('should save original token before setting new one', async () => {
            localStorageMock.setItem('bearer_token', 'original-token');
            vi.clearAllMocks();

            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionToken: 'new-session-token' }),
            });

            await adminService.impersonateUser('user-1', {
                organizationId: 'org-1',
            });

            expect(localStorageMock.setItem).toHaveBeenCalledWith('original_bearer_token', 'original-token');
            expect(localStorageMock.setItem).toHaveBeenCalledWith('bearer_token', 'new-session-token');
            expect(localStorageMock.setItem).toHaveBeenCalledWith('impersonation_mode', 'custom');
        });

        it('should throw on unified endpoint error', async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ message: 'Not a member' }),
            });

            await expect(
                adminService.impersonateUser('user-1', {
                    organizationId: 'org-1',
                }),
            ).rejects.toThrow('Not a member');
        });

        it('should throw when unified response has no sessionToken', async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            });

            await expect(
                adminService.impersonateUser('user-1', {
                    organizationId: 'org-1',
                }),
            ).rejects.toThrow('Missing impersonation session token');
        });
    });
});

describe('adminService.stopImpersonating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
    });

    describe('custom stop with preserved original token', () => {
        it('should call custom stop endpoint and restore original token', async () => {
            localStorageMock.setItem('bearer_token', 'impersonated-token');
            localStorageMock.setItem('original_bearer_token', 'original-token');
            localStorageMock.setItem('impersonation_mode', 'custom');
            vi.clearAllMocks();
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            await adminService.stopImpersonating();

            expect(mockFetchWithAuth).toHaveBeenCalledWith(
                expect.stringContaining('/api/organization/stop-impersonating'),
                expect.objectContaining({ method: 'POST' }),
            );
            expect(localStorageMock.setItem).toHaveBeenCalledWith('bearer_token', 'original-token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('original_bearer_token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('impersonation_mode');
        });

        it('should restore original token when impersonated session is already missing', async () => {
            localStorageMock.setItem('bearer_token', 'impersonated-token');
            localStorageMock.setItem('original_bearer_token', 'original-token');
            localStorageMock.setItem('impersonation_mode', 'custom');
            vi.clearAllMocks();
            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                status: 404,
                json: () => Promise.resolve({ message: 'Session not found', statusCode: 404 }),
            });

            await expect(adminService.stopImpersonating()).resolves.toBeUndefined();

            expect(localStorageMock.setItem).toHaveBeenCalledWith('bearer_token', 'original-token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('original_bearer_token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('impersonation_mode');
        });

        it('should throw on non-recoverable custom stop error', async () => {
            localStorageMock.setItem('original_bearer_token', 'original-token');
            localStorageMock.setItem('impersonation_mode', 'custom');
            vi.clearAllMocks();

            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ message: 'Internal error', statusCode: 500 }),
            });

            await expect(adminService.stopImpersonating()).rejects.toThrow('Internal error');
        });

        it('should fallback to local token restore for legacy sessions without mode metadata', async () => {
            localStorageMock.setItem('bearer_token', 'impersonated-token');
            localStorageMock.setItem('original_bearer_token', 'original-token');
            vi.clearAllMocks();

            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                status: 404,
                json: () => Promise.resolve({ message: 'Session not found', statusCode: 404 }),
            });

            await expect(adminService.stopImpersonating()).resolves.toBeUndefined();
            expect(localStorageMock.setItem).toHaveBeenCalledWith('bearer_token', 'original-token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('original_bearer_token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('impersonation_mode');
        });
    });

    describe('local fallback when original_bearer_token is missing', () => {
        it('should clear custom mode when original token is missing', async () => {
            localStorageMock.setItem('impersonation_mode', 'custom');
            vi.clearAllMocks();

            await adminService.stopImpersonating();

            expect(mockFetchWithAuth).not.toHaveBeenCalled();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('impersonation_mode');
        });

        it('should clear legacy org mode when original token is missing', async () => {
            localStorageMock.setItem('impersonation_mode', 'org');
            vi.clearAllMocks();

            await adminService.stopImpersonating();

            expect(mockFetchWithAuth).not.toHaveBeenCalled();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('impersonation_mode');
        });
    });
});
