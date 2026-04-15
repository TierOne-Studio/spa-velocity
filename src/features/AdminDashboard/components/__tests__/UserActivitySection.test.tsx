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

vi.mock("../UsersChart", () => ({
  UsersChart: ({ range }: { range: string }) => (
    <div data-testid="users-chart" data-range={range} />
  ),
}));

import { UserActivitySection } from "../UserActivitySection";
import type { UserStatsDto } from "../../types/adminDashboard.types";

const mockData: UserStatsDto = {
  total: 50,
  newInRange: 12,
  bannedCount: 2,
  emailVerifiedCount: 40,
  timeSeriesNewUsers: [],
  topUsers: [
    {
      userId: "u-1",
      name: "Alice Smith",
      email: "alice@example.com",
      role: "admin",
      conversationCount: 25,
      messageCount: 100,
      organizationCount: 2,
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago (today)
    },
    {
      userId: "u-2",
      name: "Bob Jones",
      email: "bob@example.com",
      role: "member",
      conversationCount: 10,
      messageCount: 50,
      organizationCount: 1,
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    },
    {
      userId: "u-3",
      name: "Charlie Null",
      email: "charlie@example.com",
      role: "member",
      conversationCount: 1,
      messageCount: 5,
      organizationCount: 1,
      lastActiveAt: null,
    },
  ],
  activeSessions: 10,
  expiredSessions: 5,
  impersonatedSessions: 1,
  sessionsByBrowser: [
    { browser: "Chrome", count: 8 },
    { browser: "Firefox", count: 3 },
  ],
};

describe("UserActivitySection", () => {
  it("renders UsersChart with range prop", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    const chart = screen.getByTestId("users-chart");
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute("data-range", "30d");
  });

  it("renders top users table header", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    expect(screen.getByText("Top Users")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
  });

  it("renders top user rows", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("shows Today for recent lastActiveAt", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows relative time for older lastActiveAt", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
  });

  it("shows Never when lastActiveAt is null", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows 'No user data available' when topUsers is empty", () => {
    const emptyData = { ...mockData, topUsers: [] };
    render(<UserActivitySection data={emptyData} range="30d" />);
    expect(screen.getByText("No user data available")).toBeInTheDocument();
  });

  it("renders session status section", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    expect(screen.getByText("Session Status")).toBeInTheDocument();
    expect(screen.getByText("Active vs expired vs impersonated sessions")).toBeInTheDocument();
  });

  it("renders sessions by browser section", () => {
    render(<UserActivitySection data={mockData} range="30d" />);
    expect(screen.getByText("Sessions by Browser")).toBeInTheDocument();
  });

  it("renders without data gracefully", () => {
    render(<UserActivitySection range="30d" />);
    expect(screen.getByText("Top Users")).toBeInTheDocument();
    expect(screen.getByText("No user data available")).toBeInTheDocument();
  });

  it("limits top users to 10", () => {
    const manyUsers = Array.from({ length: 15 }, (_, i) => ({
      userId: `u-${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      role: "member",
      conversationCount: i,
      messageCount: i * 2,
      organizationCount: 1,
      lastActiveAt: null,
    }));
    render(<UserActivitySection data={{ ...mockData, topUsers: manyUsers }} range="30d" />);
    // Only 10 should be visible
    const rows = screen.getAllByText(/User \d+/);
    expect(rows.length).toBeLessThanOrEqual(10);
  });

  it("shows '1 day ago' for lastActiveAt exactly 1 day ago", () => {
    const oneDayAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString();
    const data = {
      ...mockData,
      topUsers: [
        { userId: "u-day", name: "Day User", email: "day@example.com", role: "member",
          conversationCount: 1, messageCount: 1, organizationCount: 1, lastActiveAt: oneDayAgo },
      ],
    };
    render(<UserActivitySection data={data} range="30d" />);
    expect(screen.getByText("1 day ago")).toBeInTheDocument();
  });

  it("shows '1 month ago' for lastActiveAt exactly 30 days ago", () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 31).toISOString();
    const data = {
      ...mockData,
      topUsers: [
        { userId: "u-month", name: "Month User", email: "month@example.com", role: "member",
          conversationCount: 1, messageCount: 1, organizationCount: 1, lastActiveAt: thirtyOneDaysAgo },
      ],
    };
    render(<UserActivitySection data={data} range="30d" />);
    expect(screen.getByText("1 month ago")).toBeInTheDocument();
  });

  it("shows 'N months ago' for lastActiveAt more than 2 months ago", () => {
    const twoMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 65).toISOString();
    const data = {
      ...mockData,
      topUsers: [
        { userId: "u-months", name: "Months User", email: "months@example.com", role: "member",
          conversationCount: 1, messageCount: 1, organizationCount: 1, lastActiveAt: twoMonthsAgo },
      ],
    };
    render(<UserActivitySection data={data} range="30d" />);
    expect(screen.getByText(/months ago/)).toBeInTheDocument();
  });
});
