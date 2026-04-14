import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { OverviewCards } from '../components/OverviewCards';
import { ChatIntelligenceSection } from '../components/ChatIntelligenceSection';
import { UserActivitySection } from '../components/UserActivitySection';
import { OrgActivitySection } from '../components/OrgActivitySection';
import { useOverviewStats, useUserStats, useChatStats, useOrgStats, useAvailableOrgs } from '../hooks/useAdminDashboard';
import { useEffectiveSession } from '@/shared/hooks/useEffectiveSession';
import { isSuperadminRole, getSessionUserRole } from '@/shared/utils/roles';
import type { TimeRange } from '../types/adminDashboard.types';

export function AdminDashboardPage() {
  const [range, setRange] = useState<TimeRange>('30d');

  const { data: session } = useEffectiveSession();
  const isSuperadmin = isSuperadminRole(getSessionUserRole(session ?? null));
  const activeOrgId = session?.session?.activeOrganizationId ?? null;

  const { data: availableOrgs = [] } = useAvailableOrgs();

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperadmin && availableOrgs.length === 1) {
      setSelectedOrgId(availableOrgs[0].id);
    } else if (!isSuperadmin && activeOrgId && availableOrgs.some(o => o.id === activeOrgId)) {
      setSelectedOrgId(activeOrgId);
    }
  }, [availableOrgs, isSuperadmin, activeOrgId]);

  const showOrgSelector = isSuperadmin || availableOrgs.length > 1;

  const overview = useOverviewStats(selectedOrgId);
  const users = useUserStats(range, selectedOrgId);
  const chat = useChatStats(range, selectedOrgId);
  const orgs = useOrgStats(selectedOrgId);

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin Analytics</h1>
          <p className="text-muted-foreground text-sm">
            {selectedOrgId
              ? `Showing data for: ${availableOrgs.find(o => o.id === selectedOrgId)?.name ?? 'Selected organization'}`
              : 'Platform-wide usage and growth metrics'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showOrgSelector && (
            <Select
              value={selectedOrgId ?? '__all__'}
              onValueChange={(v) => setSelectedOrgId(v === '__all__' ? null : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                {isSuperadmin && (
                  <SelectItem value="__all__">All organizations</SelectItem>
                )}
                {availableOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => { if (v) setRange(v as TimeRange); }}
            variant="outline"
            className="hidden @[500px]/main:flex"
          >
            <ToggleGroupItem value="7d">7d</ToggleGroupItem>
            <ToggleGroupItem value="30d">30d</ToggleGroupItem>
            <ToggleGroupItem value="90d">90d</ToggleGroupItem>
          </ToggleGroup>
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="w-28 @[500px]/main:hidden" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Overview */}
      <OverviewCards data={overview.data} isLoading={overview.isLoading} />

      {/* Chat Intelligence */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Chat Intelligence</h2>
        {chat.isLoading ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Skeleton className="h-[360px] w-full rounded-xl" />
              <Skeleton className="h-[360px] w-full rounded-xl" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Skeleton className="h-[360px] w-full rounded-xl" />
              <Skeleton className="h-[360px] w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <ChatIntelligenceSection data={chat.data} range={range} />
        )}
      </section>

      {/* User Activity */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">User Activity</h2>
        {users.isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[360px] w-full rounded-xl" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
        ) : (
          <UserActivitySection data={users.data} range={range} />
        )}
      </section>

      {/* Organization Activity */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Organization Activity</h2>
        {orgs.isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-[360px] w-full rounded-xl" />
            <Skeleton className="h-[360px] w-full rounded-xl" />
          </div>
        ) : (
          <OrgActivitySection data={orgs.data} />
        )}
      </section>
    </div>
  );
}
