import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { ChatStatsDto, TimeRange } from '../types/adminDashboard.types';

interface ChatConversationsChartProps {
  data?: ChatStatsDto;
  isLoading: boolean;
  range: TimeRange;
}

const chartConfig = {
  userCount: { label: 'User Messages', color: 'var(--chart-1)' },
  assistantCount: { label: 'AI Messages', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export function ChatConversationsChart({ data, isLoading, range }: ChatConversationsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.timeSeriesMessages ?? [];

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Message Activity</CardTitle>
        <CardDescription>
          User vs AI messages over the last {range}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillUserCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-userCount)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-userCount)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillAssistantCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-assistantCount)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-assistantCount)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value: string) =>
                    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="userCount"
              type="natural"
              fill="url(#fillUserCount)"
              stroke="var(--color-userCount)"
              stackId="messages"
            />
            <Area
              dataKey="assistantCount"
              type="natural"
              fill="url(#fillAssistantCount)"
              stroke="var(--color-assistantCount)"
              stackId="messages"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
