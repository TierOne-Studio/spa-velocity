import { useQuery } from '@tanstack/react-query';
import { adminDashboardService } from '../services/adminDashboard.service';
import type { TimeRange } from '../types/adminDashboard.types';

export const dashboardKeys = {
  overview: ['admin-dashboard', 'overview'] as const,
  users: (range: TimeRange) => ['admin-dashboard', 'users', range] as const,
  chat: (range: TimeRange) => ['admin-dashboard', 'chat', range] as const,
  orgs: ['admin-dashboard', 'orgs'] as const,
};

export function useOverviewStats() {
  return useQuery({
    queryKey: dashboardKeys.overview,
    queryFn: () => adminDashboardService.getOverview(),
    staleTime: 60_000,
  });
}

export function useUserStats(range: TimeRange) {
  return useQuery({
    queryKey: dashboardKeys.users(range),
    queryFn: () => adminDashboardService.getUserStats(range),
    staleTime: 60_000,
  });
}

export function useChatStats(range: TimeRange) {
  return useQuery({
    queryKey: dashboardKeys.chat(range),
    queryFn: () => adminDashboardService.getChatStats(range),
    staleTime: 60_000,
  });
}

export function useOrgStats() {
  return useQuery({
    queryKey: dashboardKeys.orgs,
    queryFn: () => adminDashboardService.getOrgStats(),
    staleTime: 60_000,
  });
}
