import { IconUsers, IconMessages } from '@tabler/icons-react';
import { IconActivity } from '@tabler/icons-react';
import { IconMessage2 } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { OverviewStats } from '../types/adminDashboard.types';

interface OverviewCardsProps {
  data?: OverviewStats;
  isLoading: boolean;
}

export function OverviewCards({ data, isLoading }: OverviewCardsProps) {
  const cards = [
    {
      title: 'Total Users',
      value: data?.totalUsers ?? 0,
      subtitle: `${data?.bannedUsers ?? 0} banned`,
      icon: IconUsers,
    },
    {
      title: 'Active Sessions',
      value: data?.activeSessions ?? 0,
      subtitle: `${data?.activeUsers ?? 0} active users`,
      icon: IconActivity,
    },
    {
      title: 'Total Conversations',
      value: data?.totalConversations ?? 0,
      subtitle: `${data?.totalOrganizations ?? 0} organizations`,
      icon: IconMessages,
    },
    {
      title: 'Total Messages',
      value: data?.totalMessages ?? 0,
      subtitle: `${data?.totalProjects ?? 0} projects`,
      icon: IconMessage2,
    },
  ];

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
              {value.toLocaleString()}
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
