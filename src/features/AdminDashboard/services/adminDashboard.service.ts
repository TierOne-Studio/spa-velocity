import { fetchApi } from '@shared/lib/fetch-with-auth';
import type { OverviewStatsDto, UserStatsDto, ChatStatsDto, OrgStatsDto, OrgListItem, TimeRange } from '../types/adminDashboard.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function appendOrgId(base: string, organizationId?: string | null): string {
  if (!organizationId) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}organizationId=${encodeURIComponent(organizationId)}`;
}

export const adminDashboardService = {
  getAvailableOrganizations(): Promise<OrgListItem[]> {
    return fetchApi<OrgListItem[]>(
      `${API_BASE_URL}/api/admin/dashboard/organizations/list`,
      undefined,
      'Failed to load available organizations',
    );
  },
  getOverview(organizationId?: string | null): Promise<OverviewStatsDto> {
    return fetchApi<OverviewStatsDto>(
      appendOrgId(`${API_BASE_URL}/api/admin/dashboard/overview`, organizationId),
      undefined,
      'Failed to load overview stats',
    );
  },
  getUserStats(range: TimeRange, organizationId?: string | null): Promise<UserStatsDto> {
    return fetchApi<UserStatsDto>(
      appendOrgId(`${API_BASE_URL}/api/admin/dashboard/users?range=${range}`, organizationId),
      undefined,
      'Failed to load user stats',
    );
  },
  getChatStats(range: TimeRange, organizationId?: string | null): Promise<ChatStatsDto> {
    return fetchApi<ChatStatsDto>(
      appendOrgId(`${API_BASE_URL}/api/admin/dashboard/chat?range=${range}`, organizationId),
      undefined,
      'Failed to load chat stats',
    );
  },
  getOrgStats(organizationId?: string | null): Promise<OrgStatsDto> {
    return fetchApi<OrgStatsDto>(
      appendOrgId(`${API_BASE_URL}/api/admin/dashboard/organizations`, organizationId),
      undefined,
      'Failed to load organization stats',
    );
  },
};
