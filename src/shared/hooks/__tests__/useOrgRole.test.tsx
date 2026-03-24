import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseEffectiveSession = vi.fn();

vi.mock('@shared/hooks/useEffectiveSession', () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

import { useOrgRole } from '../useOrgRole';

describe('useOrgRole', () => {
  beforeEach(() => {
    mockUseEffectiveSession.mockReset();
  });

  it('returns null activeOrganizationId and false isInOrganization when session is null', () => {
    mockUseEffectiveSession.mockReturnValue({ data: null });

    const { result } = renderHook(() => useOrgRole());

    expect(result.current.activeOrganizationId).toBeNull();
    expect(result.current.isInOrganization).toBe(false);
  });

  it('returns null when session has no session data', () => {
    mockUseEffectiveSession.mockReturnValue({
      data: { user: { id: 'u1', email: 'u@example.com' } },
    });

    const { result } = renderHook(() => useOrgRole());

    expect(result.current.activeOrganizationId).toBeNull();
    expect(result.current.isInOrganization).toBe(false);
  });

  it('returns null when session.session has no activeOrganizationId', () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: 'u1' },
        session: {},
      },
    });

    const { result } = renderHook(() => useOrgRole());

    expect(result.current.activeOrganizationId).toBeNull();
    expect(result.current.isInOrganization).toBe(false);
  });

  it('returns activeOrganizationId and true isInOrganization when org is active', () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: 'u1' },
        session: { activeOrganizationId: 'org-123' },
      },
    });

    const { result } = renderHook(() => useOrgRole());

    expect(result.current.activeOrganizationId).toBe('org-123');
    expect(result.current.isInOrganization).toBe(true);
  });

  it('returns null when activeOrganizationId is undefined', () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: 'u1' },
        session: { activeOrganizationId: undefined },
      },
    });

    const { result } = renderHook(() => useOrgRole());

    expect(result.current.activeOrganizationId).toBeNull();
    expect(result.current.isInOrganization).toBe(false);
  });
});
