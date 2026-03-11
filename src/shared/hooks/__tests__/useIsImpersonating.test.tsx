import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseEffectiveSession = vi.fn();

vi.mock('@shared/hooks/useEffectiveSession', () => ({
    useEffectiveSession: () => mockUseEffectiveSession(),
}));

import { useIsImpersonating } from '../useIsImpersonating';

describe('useIsImpersonating (PR#7 - role-based actions)', () => {
    beforeEach(() => {
        mockUseEffectiveSession.mockReset();
        localStorage.clear();
    });

    it('should return isImpersonating=true when session has impersonatedBy', () => {
        mockUseEffectiveSession.mockReturnValue({
            data: {
                session: { impersonatedBy: 'manager-user-id' },
            },
        });

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(true);
        expect(result.current.impersonatedBy).toBe('manager-user-id');
    });

    it('should return isImpersonating=false when no impersonatedBy', () => {
        mockUseEffectiveSession.mockReturnValue({
            data: {
                session: {},
            },
        });

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(false);
        expect(result.current.impersonatedBy).toBeNull();
    });

    it('should return isImpersonating=false when no session', () => {
        mockUseEffectiveSession.mockReturnValue({ data: null });

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(false);
        expect(result.current.impersonatedBy).toBeNull();
    });

    it('should return isImpersonating=true for unified custom impersonation stored in localStorage', () => {
        mockUseEffectiveSession.mockReturnValue({
            data: {
                session: {},
            },
        });
        localStorage.setItem('original_bearer_token', 'manager-original-token');
        localStorage.setItem('impersonation_mode', 'custom');

        const { result } = renderHook(() => useIsImpersonating());

        expect(result.current.isImpersonating).toBe(true);
        expect(result.current.impersonatedBy).toBeNull();
    });

    it('should continue to support legacy org-scoped impersonation markers', () => {
        mockUseEffectiveSession.mockReturnValue({
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
