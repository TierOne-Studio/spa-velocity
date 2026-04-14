import { fetchApi } from '@shared/lib/fetch-with-auth';
import type {
  OverviewStats,
  UserStats,
  SessionStats,
  ChatStats,
  ProjectStats,
  TimeRange,
} from '../types/adminDashboard.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const adminDashboardService = {
  getOverview(): Promise<OverviewStats> {
    return fetchApi<OverviewStats>(
      `${API_BASE_URL}/api/admin/dashboard/overview`,
      undefined,
      'Failed to load overview stats',
    );
  },

  getUserStats(range: TimeRange): Promise<UserStats> {
    return fetchApi<UserStats>(
      `${API_BASE_URL}/api/admin/dashboard/users?range=${range}`,
      undefined,
      'Failed to load user stats',
    );
  },

  getSessionStats(range: TimeRange): Promise<SessionStats> {
    return fetchApi<SessionStats>(
      `${API_BASE_URL}/api/admin/dashboard/sessions?range=${range}`,
      undefined,
      'Failed to load session stats',
    );
  },

  getChatStats(range: TimeRange): Promise<ChatStats> {
    return fetchApi<ChatStats>(
      `${API_BASE_URL}/api/admin/dashboard/chat?range=${range}`,
      undefined,
      'Failed to load chat stats',
    );
  },

  getProjectStats(): Promise<ProjectStats> {
    return fetchApi<ProjectStats>(
      `${API_BASE_URL}/api/admin/dashboard/projects`,
      undefined,
      'Failed to load project stats',
    );
  },
};
