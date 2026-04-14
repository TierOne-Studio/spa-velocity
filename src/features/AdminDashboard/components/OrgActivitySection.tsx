import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import type { OrgStatsDto } from '../types/adminDashboard.types';

interface OrgActivitySectionProps {
  data?: OrgStatsDto;
}

const conversationsConfig = {
  conversationCount: { label: 'Conversations', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const membersConfig = {
  memberCount: { label: 'Members', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const roleConfig = {
  count: { label: 'Members', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function OrgActivitySection({ data }: OrgActivitySectionProps) {
  const conversationsPerOrg = data?.conversationsPerOrg ?? [];
  const membersPerOrg = data?.membersPerOrg ?? [];
  const roleDistribution = data?.memberRoleDistribution ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Conversations per Organization</CardTitle>
            <CardDescription>Total conversations broken down by org</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={conversationsConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={conversationsPerOrg}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="orgName"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="conversationCount" fill="var(--color-conversationCount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Members per Organization</CardTitle>
            <CardDescription>Team size across organizations</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={membersConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={membersPerOrg}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="orgName"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="memberCount" fill="var(--color-memberCount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Member Role Distribution</CardTitle>
          <CardDescription>Role breakdown across all organizations</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer config={roleConfig} className="aspect-auto h-[250px] w-full">
            <BarChart data={roleDistribution}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="role" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
