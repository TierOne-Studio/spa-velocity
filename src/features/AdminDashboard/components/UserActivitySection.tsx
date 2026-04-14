import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import { UsersChart } from './UsersChart';
import type { UserStatsDto, TimeRange } from '../types/adminDashboard.types';

interface UserActivitySectionProps {
  data?: UserStatsDto;
  range: TimeRange;
}

const sessionsConfig = {
  count: { label: 'Sessions', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const browserConfig = {
  count: { label: 'Sessions', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
}

export function UserActivitySection({ data, range }: UserActivitySectionProps) {
  const sessionBreakdownData = [
    { label: 'Active', count: data?.activeSessions ?? 0 },
    { label: 'Expired', count: data?.expiredSessions ?? 0 },
    { label: 'Impersonated', count: data?.impersonatedSessions ?? 0 },
  ];

  const browserData = data?.sessionsByBrowser ?? [];
  const topUsers = (data?.topUsers ?? []).slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      {/* New users time series */}
      <UsersChart data={data} isLoading={false} range={range} />

      {/* Top Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Users</CardTitle>
          <CardDescription>Most active users by conversation and message count</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="text-muted-foreground pb-2 pr-4 font-medium">User</th>
                <th className="text-muted-foreground pb-2 pr-4 font-medium">Email</th>
                <th className="text-muted-foreground pb-2 pr-4 font-medium">Role</th>
                <th className="text-muted-foreground pb-2 pr-4 font-medium text-right">Conversations</th>
                <th className="text-muted-foreground pb-2 pr-4 font-medium text-right">Messages</th>
                <th className="text-muted-foreground pb-2 pr-4 font-medium text-right">Orgs</th>
                <th className="text-muted-foreground pb-2 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((user) => (
                <tr key={user.userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{user.name}</td>
                  <td className="text-muted-foreground py-2 pr-4">{user.email}</td>
                  <td className="py-2 pr-4">
                    <span className="bg-muted rounded px-1.5 py-0.5 text-xs capitalize">{user.role}</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{user.conversationCount}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{user.messageCount}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{user.organizationCount}</td>
                  <td className="text-muted-foreground py-2 text-sm">
                    {formatRelativeTime(user.lastActiveAt)}
                  </td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground py-4 text-center">
                    No user data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Sessions breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Session Status</CardTitle>
            <CardDescription>Active vs expired vs impersonated sessions</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={sessionsConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={sessionBreakdownData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Sessions by Browser</CardTitle>
            <CardDescription>Browser distribution of active sessions</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={browserConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={browserData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="browser" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
