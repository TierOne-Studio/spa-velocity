import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock recharts to avoid SVG rendering issues
vi.mock("recharts", () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: ReactNode }) => <div data-testid="area-chart">{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/shared/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

import { ChatConversationsChart } from "../ChatConversationsChart";
import type { ChatStatsDto } from "../../types/adminDashboard.types";

const mockChatData: ChatStatsDto = {
  totalConversations: 10,
  totalMessages: 50,
  assistantMessages: 25,
  userMessages: 25,
  avgMessagesPerConversation: 5,
  activeConversationsInRange: 8,
  timeSeriesConversations: [],
  timeSeriesMessages: [
    { date: "2026-01-01", userCount: 3, assistantCount: 3 },
    { date: "2026-01-02", userCount: 5, assistantCount: 5 },
  ],
  generatorDistribution: [],
  sourceIntegrationUsage: [],
  entityTypeBreakdown: [],
  avgToolCallsPerResponse: null,
  avgResultsPerResponse: null,
  totalTokens: null,
  totalPromptTokens: null,
  totalCompletionTokens: null,
  avgTokensPerResponse: null,
  messagesWithTokenData: 0,
};

describe("ChatConversationsChart", () => {
  it("renders loading skeleton when isLoading is true", () => {
    render(<ChatConversationsChart isLoading={true} range="30d" />);
    // Loading shows skeletons
    expect(screen.queryByText("Message Activity")).not.toBeInTheDocument();
  });

  it("renders chart when not loading", () => {
    render(<ChatConversationsChart data={mockChatData} isLoading={false} range="30d" />);
    expect(screen.getByText("Message Activity")).toBeInTheDocument();
  });

  it("shows range in description", () => {
    render(<ChatConversationsChart data={mockChatData} isLoading={false} range="7d" />);
    expect(screen.getByText(/7d/)).toBeInTheDocument();
  });

  it("renders without data (undefined)", () => {
    render(<ChatConversationsChart isLoading={false} range="30d" />);
    expect(screen.getByText("Message Activity")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("renders chart container", () => {
    render(<ChatConversationsChart data={mockChatData} isLoading={false} range="90d" />);
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });
});
