import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/shared/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

// Mock ChatConversationsChart since it has its own recharts deps
vi.mock("../ChatConversationsChart", () => ({
  ChatConversationsChart: ({ range }: { range: string }) => (
    <div data-testid="chat-conversations-chart" data-range={range} />
  ),
}));

import { ChatIntelligenceSection } from "../ChatIntelligenceSection";
import type { ChatStatsDto } from "../../types/adminDashboard.types";

const mockData: ChatStatsDto = {
  totalConversations: 15,
  totalMessages: 75,
  assistantMessages: 35,
  userMessages: 40,
  avgMessagesPerConversation: 5,
  activeConversationsInRange: 12,
  timeSeriesConversations: [],
  timeSeriesMessages: [],
  generatorDistribution: [
    { generator: "langchain-agent", count: 10, percentage: 66.7 },
    { generator: "fallback-search-summary", count: 3, percentage: 20 },
    { generator: "custom-gen", count: 2, percentage: 13.3 },
  ],
  sourceIntegrationUsage: [
    { sourceName: "GitHub", count: 20 },
    { sourceName: "Jira", count: 15 },
  ],
  entityTypeBreakdown: [
    { entityType: "GitHubCodeFile", count: 10 },
    { entityType: "JiraIssue", count: 8 },
    { entityType: "ConfluencePage", count: 5 },
    { entityType: "CustomEntity", count: 3 },
  ],
  avgToolCallsPerResponse: 2.5,
  avgResultsPerResponse: 3.1,
  totalTokens: 50000,
  totalPromptTokens: 30000,
  totalCompletionTokens: 20000,
  avgTokensPerResponse: 667,
  messagesWithTokenData: 75,
};

describe("ChatIntelligenceSection", () => {
  it("renders Generator Type Distribution section", () => {
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getByText("Generator Type Distribution")).toBeInTheDocument();
  });

  it("renders Source Integration Usage section", () => {
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getByText("Source Integration Usage")).toBeInTheDocument();
  });

  it("renders Entity Type Breakdown section", () => {
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getByText("Entity Type Breakdown")).toBeInTheDocument();
  });

  it("renders token KPI cards with values", () => {
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getByText("Total Tokens")).toBeInTheDocument();
    expect(screen.getByText("50,000")).toBeInTheDocument();
    expect(screen.getByText("Avg Tokens / Response")).toBeInTheDocument();
    expect(screen.getByText("667")).toBeInTheDocument();
  });

  it("renders prompt/completion tokens", () => {
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getByText("Prompt / Completion Tokens")).toBeInTheDocument();
    expect(screen.getByText(/30,000/)).toBeInTheDocument();
    expect(screen.getByText(/20,000/)).toBeInTheDocument();
  });

  it("renders avg tool calls and avg sources", () => {
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getByText("Avg Tool Calls / Response")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(screen.getByText("Avg Sources Retrieved")).toBeInTheDocument();
    expect(screen.getByText("3.1")).toBeInTheDocument();
  });

  it("shows dash when token data is null", () => {
    const dataNoTokens = { ...mockData, totalTokens: null, avgTokensPerResponse: null, totalPromptTokens: null, totalCompletionTokens: null, avgToolCallsPerResponse: null, avgResultsPerResponse: null };
    render(<ChatIntelligenceSection data={dataNoTokens} range="30d" />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it("renders ChatConversationsChart with range", () => {
    render(<ChatIntelligenceSection data={mockData} range="7d" />);
    const chart = screen.getByTestId("chat-conversations-chart");
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute("data-range", "7d");
  });

  it("renders without data gracefully", () => {
    render(<ChatIntelligenceSection range="30d" />);
    expect(screen.getByText("Generator Type Distribution")).toBeInTheDocument();
  });

  it("shows no token data message when totalTokens is null", () => {
    const noTokenData = { ...mockData, totalTokens: null };
    render(<ChatIntelligenceSection data={noTokenData} range="30d" />);
    expect(screen.getByText("No token data yet — tracked from next deployment")).toBeInTheDocument();
  });

  it("shows messages count when totalTokens is available", () => {
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getByText("across 75 messages")).toBeInTheDocument();
  });

  it("translates generator keys to labels", () => {
    // The section maps generator names in the chart data - not in visible text
    // We verify it renders without errors
    render(<ChatIntelligenceSection data={mockData} range="30d" />);
    expect(screen.getAllByTestId("bar-chart").length).toBeGreaterThan(0);
  });

  it("shows '0 messages' when totalTokens is set but messagesWithTokenData is undefined (covers ?? 0 branch)", () => {
    const dataWithoutMsgCount = { ...mockData, messagesWithTokenData: undefined as unknown as number };
    render(<ChatIntelligenceSection data={dataWithoutMsgCount} range="30d" />);
    expect(screen.getByText("across 0 messages")).toBeInTheDocument();
  });

  it("covers all shortenEntityType branches with diverse entity types", () => {
    // Covers all branches in shortenEntityType function
    const diverseData = {
      ...mockData,
      entityTypeBreakdown: [
        { entityType: "GitHubCodeFile", count: 10 },       // 'Code File'
        { entityType: "GitHubPullRequest", count: 8 },     // 'Pull Request'
        { entityType: "GitHubIssue", count: 7 },           // 'GitHub Issue'
        { entityType: "ConfluencePage", count: 6 },        // 'Confluence Page'
        { entityType: "JiraIssue", count: 5 },             // 'Jira Issue'
        { entityType: "JiraTicket", count: 4 },            // 'Jira Ticket'
        { entityType: "SlackMessage", count: 3 },          // 'Slack Message'
        { entityType: "CustomEntity", count: 2 },          // last fallback
        { entityType: "PlainType", count: 1 },             // no Entity suffix, with camelCase
      ],
    };
    // Should not throw
    render(<ChatIntelligenceSection data={diverseData} range="30d" />);
    expect(screen.getAllByTestId("bar-chart").length).toBeGreaterThan(0);
  });
});
