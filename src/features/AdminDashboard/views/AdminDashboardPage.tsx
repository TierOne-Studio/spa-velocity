import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { OverviewCards } from '../components/OverviewCards';
import { UsersChart } from '../components/UsersChart';
import { SessionsChart } from '../components/SessionsChart';
import { ChatConversationsChart } from '../components/ChatConversationsChart';
import { MessagesByRoleChart } from '../components/MessagesByRoleChart';
import { ProjectStatusChart } from '../components/ProjectStatusChart';
import {
  useOverviewStats,
  useUserStats,
  useSessionStats,
  useChatStats,
  useProjectStats,
} from '../hooks/useAdminDashboard';
import type { TimeRange } from '../types/adminDashboard.types';

export function AdminDashboardPage() {
  const [range, setRange] = useState<TimeRange>('30d');

  const overview = useOverviewStats();
  const users = useUserStats(range);
  const sessions = useSessionStats(range);
  const chat = useChatStats(range);
  const projects = useProjectStats();

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin Analytics</h1>
          <p className="text-muted-foreground text-sm">Platform-wide usage and growth metrics</p>
        </div>

        {/* Range toggle — ToggleGroup on desktop, Select on mobile */}
        <div className="flex items-center gap-2">
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

      {/* Row 1: KPI Overview Cards */}
      <OverviewCards data={overview.data} isLoading={overview.isLoading} />

      {/* Row 2: Users chart — full width */}
      <UsersChart data={users.data} isLoading={users.isLoading} range={range} />

      {/* Row 3: Sessions | Chat Conversations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SessionsChart data={sessions.data} isLoading={sessions.isLoading} range={range} />
        <ChatConversationsChart data={chat.data} isLoading={chat.isLoading} range={range} />
      </div>

      {/* Row 4: Messages by Role | Project Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MessagesByRoleChart data={chat.data} isLoading={chat.isLoading} />
        <ProjectStatusChart data={projects.data} isLoading={projects.isLoading} />
      </div>
    </div>
  );
}
