import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseSession = vi.fn();

vi.mock('@shared/lib/auth-client', () => ({
    useSession: () => mockUseSession(),
}));

import { useIsImpersonating } from '../useIsImpersonating';

describe('useIsImpersonating (PR#7 - role-based actions)', () => {
    beforeEach(() => {
        mockUseSession.mockReset();
        localStorage.clear();
    });

    it('should return isImpersonating=true when session has impersonatedBy', () => {
        mockUseSession.mockReturnValue({
            data: {
                session: { impersonatedBy: 'manager-user-id' },
            },
        });

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(true);
        expect(result.current.impersonatedBy).toBe('manager-user-id');
    });

    it('should return isImpersonating=false when no impersonatedBy', () => {
        mockUseSession.mockReturnValue({
            data: {
                session: {},
            },
        });

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(false);
        expect(result.current.impersonatedBy).toBeNull();
    });

    it('should return isImpersonating=false when no session', () => {
        mockUseSession.mockReturnValue({ data: null });

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(false);
        expect(result.current.impersonatedBy).toBeNull();
    });

    it('should return isImpersonating=true for org-scoped manager impersonation stored in localStorage', () => {
        mockUseSession.mockReturnValue({
            data: {
                session: {},
            },
        });
        localStorage.setItem('original_bearer_token', 'manager-original-token');
        localStorage.setItem('impersonation_mode', 'org');

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(true);
        expect(result.current.impersonatedBy).toBeNull();
    });
});
