import { fetchApi } from '@shared/lib/fetch-with-auth';
import type { OverviewStatsDto, UserStatsDto, ChatStatsDto, OrgStatsDto, TimeRange } from '../types/adminDashboard.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const adminDashboardService = {
  getOverview(): Promise<OverviewStatsDto> {
    return fetchApi<OverviewStatsDto>(
      `${API_BASE_URL}/api/admin/dashboard/overview`,
      undefined,
      'Failed to load overview stats',
    );
  },
  getUserStats(range: TimeRange): Promise<UserStatsDto> {
    return fetchApi<UserStatsDto>(
      `${API_BASE_URL}/api/admin/dashboard/users?range=${range}`,
      undefined,
      'Failed to load user stats',
    );
  },
  getChatStats(range: TimeRange): Promise<ChatStatsDto> {
    return fetchApi<ChatStatsDto>(
      `${API_BASE_URL}/api/admin/dashboard/chat?range=${range}`,
      undefined,
      'Failed to load chat stats',
    );
  },
  getOrgStats(): Promise<OrgStatsDto> {
    return fetchApi<OrgStatsDto>(
      `${API_BASE_URL}/api/admin/dashboard/organizations`,
      undefined,
      'Failed to load organization stats',
    );
  },
};
