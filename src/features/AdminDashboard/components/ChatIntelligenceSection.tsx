import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import { ChatConversationsChart } from './ChatConversationsChart';
import type { ChatStatsDto, TimeRange } from '../types/adminDashboard.types';

interface ChatIntelligenceSectionProps {
  data?: ChatStatsDto;
  range: TimeRange;
}

const GENERATOR_LABELS: Record<string, string> = {
  'langchain-agent': 'Agent',
  'fallback-search-summary': 'Search Fallback',
  'fallback-no-results': 'No Results Fallback',
};

function shortenEntityType(entityType: string): string {
  if (entityType.includes('GitHubCodeFile')) return 'Code File';
  if (entityType.includes('GitHubPullRequest')) return 'Pull Request';
  if (entityType.includes('GitHubIssue')) return 'GitHub Issue';
  if (entityType.includes('ConfluencePage')) return 'Confluence Page';
  if (entityType.includes('JiraIssue')) return 'Jira Issue';
  if (entityType.includes('JiraTicket')) return 'Jira Ticket';
  if (entityType.includes('SlackMessage')) return 'Slack Message';
  return entityType.replace(/Entity$/, '').replace(/([A-Z])/g, ' $1').trim();
}

const generatorConfig = {
  count: { label: 'Count', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const sourceConfig = {
  count: { label: 'Usage Count', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const entityConfig = {
  count: { label: 'Count', color: 'var(--chart-4)' },
} satisfies ChartConfig;

export function ChatIntelligenceSection({ data, range }: ChatIntelligenceSectionProps) {
  const generatorData = (data?.generatorDistribution ?? []).map((d) => ({
    generator: GENERATOR_LABELS[d.generator] ?? d.generator,
    count: d.count,
  }));

  const sourceData = data?.sourceIntegrationUsage ?? [];

  const entityData = (data?.entityTypeBreakdown ?? []).map((d) => ({
    entityType: shortenEntityType(d.entityType),
    count: d.count,
  }));

  const tokens = data?.totalTokens;
  const avgTokens = data?.avgTokensPerResponse;
  const promptTokens = data?.totalPromptTokens;
  const completionTokens = data?.totalCompletionTokens;
  const avgToolCalls = data?.avgToolCallsPerResponse;
  const avgResults = data?.avgResultsPerResponse;

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Message time series + Generator distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChatConversationsChart data={data} isLoading={false} range={range} />

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Generator Type Distribution</CardTitle>
            <CardDescription>How conversations were handled</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={generatorConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={generatorData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  type="category"
                  dataKey="generator"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={120}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Source integrations + Entity types */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Source Integration Usage</CardTitle>
            <CardDescription>Which integrations are queried most</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={sourceConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={sourceData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="sourceName" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Entity Type Breakdown</CardTitle>
            <CardDescription>Types of content retrieved</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={entityConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={entityData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  type="category"
                  dataKey="entityType"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={120}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Token KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tokens</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {tokens != null ? tokens.toLocaleString() : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {tokens == null
                ? 'No token data yet — tracked from next deployment'
                : `across ${data?.messagesWithTokenData ?? 0} messages`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Tokens / Response</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {avgTokens != null ? avgTokens.toLocaleString() : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">per assistant message</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prompt / Completion Tokens</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {promptTokens != null ? promptTokens.toLocaleString() : '—'}
              {' / '}
              {completionTokens != null ? completionTokens.toLocaleString() : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">input vs output tokens</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent performance stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Tool Calls / Response</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {avgToolCalls != null ? avgToolCalls.toFixed(1) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">agent tool invocations per reply</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Sources Retrieved</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {avgResults != null ? avgResults.toFixed(1) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">search results per response</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
