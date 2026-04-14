import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { ChatStatsDto } from '../types/adminDashboard.types';

interface MessagesByRoleChartProps {
  data?: ChatStatsDto;
  isLoading: boolean;
}

const chartConfig = {
  count: { label: 'Messages', color: 'var(--chart-4)' },
} satisfies ChartConfig;

export function MessagesByRoleChart({ data, isLoading }: MessagesByRoleChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { role: 'User', count: data?.userMessages ?? 0 },
    { role: 'Assistant', count: data?.assistantMessages ?? 0 },
  ];

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Messages by Role</CardTitle>
        <CardDescription>
          Total {(data?.totalMessages ?? 0).toLocaleString()} messages across all roles
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="role" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
