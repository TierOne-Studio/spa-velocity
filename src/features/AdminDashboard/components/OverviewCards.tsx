import { IconUsers, IconUserScan, IconMessages, IconBrain } from '@tabler/icons-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { OverviewStatsDto } from '../types/adminDashboard.types';

interface OverviewCardsProps {
  data?: OverviewStatsDto;
  isLoading: boolean;
}

export function OverviewCards({ data, isLoading }: OverviewCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const tokens = data?.totalTokensAllTime;
  const cards = [
    {
      title: 'Total Users',
      value: (data?.totalUsers ?? 0).toLocaleString(),
      subtitle: `${data?.bannedUsers ?? 0} banned`,
      icon: IconUsers,
    },
    {
      title: 'Active Sessions',
      value: (data?.activeSessions ?? 0).toLocaleString(),
      subtitle: `${data?.totalOrganizations ?? 0} orgs`,
      icon: IconUserScan,
    },
    {
      title: 'Conversations',
      value: (data?.totalConversations ?? 0).toLocaleString(),
      subtitle: `${(data?.totalMessages ?? 0).toLocaleString()} messages total`,
      icon: IconMessages,
    },
    {
      title: 'AI Tokens Used',
      value: tokens != null ? tokens.toLocaleString() : '—',
      subtitle: 'tracked since deployment',
      icon: IconBrain,
    },
  ];

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:grid-cols-4">
      {cards.map(({ title, value, subtitle, icon: Icon }) => (
        <Card key={title} className="@container/card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>{title}</CardDescription>
              <Icon className="text-muted-foreground size-4" />
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {value}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
