import { useQuery } from '@tanstack/react-query';
import { adminDashboardService } from '../services/adminDashboard.service';
import type { TimeRange } from '../types/adminDashboard.types';

export const dashboardKeys = {
  overview: (orgId: string | null) => ['admin-dashboard', 'overview', orgId] as const,
  users: (range: TimeRange, orgId: string | null) => ['admin-dashboard', 'users', range, orgId] as const,
  chat: (range: TimeRange, orgId: string | null) => ['admin-dashboard', 'chat', range, orgId] as const,
  orgs: (orgId: string | null) => ['admin-dashboard', 'orgs', orgId] as const,
  availableOrgs: ['admin-dashboard', 'available-orgs'] as const,
};

export function useOverviewStats(organizationId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.overview(organizationId),
    queryFn: () => adminDashboardService.getOverview(organizationId),
    staleTime: 60_000,
  });
}

export function useUserStats(range: TimeRange, organizationId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.users(range, organizationId),
    queryFn: () => adminDashboardService.getUserStats(range, organizationId),
    staleTime: 60_000,
  });
}

export function useChatStats(range: TimeRange, organizationId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.chat(range, organizationId),
    queryFn: () => adminDashboardService.getChatStats(range, organizationId),
    staleTime: 60_000,
  });
}

export function useOrgStats(organizationId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.orgs(organizationId),
    queryFn: () => adminDashboardService.getOrgStats(organizationId),
    staleTime: 60_000,
  });
}

export function useAvailableOrgs() {
  return useQuery({
    queryKey: dashboardKeys.availableOrgs,
    queryFn: () => adminDashboardService.getAvailableOrganizations(),
    staleTime: 60_000,
  });
}
