import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

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

import { UsersChart } from "../UsersChart";
import type { UserStatsDto } from "../../types/adminDashboard.types";

const mockUserData: UserStatsDto = {
  total: 50,
  newInRange: 12,
  bannedCount: 2,
  emailVerifiedCount: 40,
  timeSeriesNewUsers: [
    { date: "2026-01-01", count: 3 },
    { date: "2026-01-02", count: 5 },
  ],
  topUsers: [],
  activeSessions: 10,
  expiredSessions: 5,
  impersonatedSessions: 1,
  sessionsByBrowser: [],
};

describe("UsersChart", () => {
  it("renders loading skeleton when isLoading is true", () => {
    render(<UsersChart isLoading={true} range="30d" />);
    expect(screen.queryByText("New Users")).not.toBeInTheDocument();
  });

  it("renders chart title when not loading", () => {
    render(<UsersChart data={mockUserData} isLoading={false} range="30d" />);
    expect(screen.getByText("New Users")).toBeInTheDocument();
  });

  it("shows new user count and range in description", () => {
    render(<UsersChart data={mockUserData} isLoading={false} range="30d" />);
    expect(screen.getByText("12 new users in the last 30d")).toBeInTheDocument();
  });

  it("renders with 7d range", () => {
    render(<UsersChart data={mockUserData} isLoading={false} range="7d" />);
    expect(screen.getByText("12 new users in the last 7d")).toBeInTheDocument();
  });

  it("renders without data (undefined)", () => {
    render(<UsersChart isLoading={false} range="30d" />);
    expect(screen.getByText("New Users")).toBeInTheDocument();
    expect(screen.getByText("0 new users in the last 30d")).toBeInTheDocument();
  });

  it("renders chart container with data", () => {
    render(<UsersChart data={mockUserData} isLoading={false} range="90d" />);
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });
});
