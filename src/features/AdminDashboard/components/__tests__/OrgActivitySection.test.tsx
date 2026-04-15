import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  CartesianGrid: () => null,
  XAxis: ({ tickFormatter }: { tickFormatter?: (v: string) => string }) => {
    // Invoke tickFormatter with both short and long values to cover all branches
    if (tickFormatter) {
      tickFormatter("Short");
      tickFormatter("A Very Long Organization Name");
    }
    return null;
  },
  YAxis: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/shared/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

import { OrgActivitySection } from "../OrgActivitySection";
import type { OrgStatsDto } from "../../types/adminDashboard.types";

const mockData: OrgStatsDto = {
  totalOrganizations: 3,
  pendingInvitations: 2,
  conversationsPerOrg: [
    { orgId: "o-1", orgName: "Alpha Corp", conversationCount: 50, messageCount: 200 },
    { orgId: "o-2", orgName: "Beta Inc", conversationCount: 30, messageCount: 120 },
  ],
  membersPerOrg: [
    { orgId: "o-1", orgName: "Alpha Corp", memberCount: 10 },
    { orgId: "o-2", orgName: "Beta Inc", memberCount: 5 },
  ],
  memberRoleDistribution: [
    { role: "admin", count: 3 },
    { role: "member", count: 12 },
  ],
  mostActiveOrgs: [],
};

describe("OrgActivitySection", () => {
  it("renders Conversations per Organization section", () => {
    render(<OrgActivitySection data={mockData} />);
    expect(screen.getByText("Conversations per Organization")).toBeInTheDocument();
  });

  it("renders Members per Organization section", () => {
    render(<OrgActivitySection data={mockData} />);
    expect(screen.getByText("Members per Organization")).toBeInTheDocument();
  });

  it("renders Member Role Distribution section", () => {
    render(<OrgActivitySection data={mockData} />);
    expect(screen.getByText("Member Role Distribution")).toBeInTheDocument();
  });

  it("renders chart containers", () => {
    render(<OrgActivitySection data={mockData} />);
    const charts = screen.getAllByTestId("chart-container");
    expect(charts.length).toBeGreaterThanOrEqual(3);
  });

  it("renders bar charts", () => {
    render(<OrgActivitySection data={mockData} />);
    const barCharts = screen.getAllByTestId("bar-chart");
    expect(barCharts.length).toBeGreaterThanOrEqual(3);
  });

  it("renders without data gracefully (empty arrays)", () => {
    render(<OrgActivitySection />);
    expect(screen.getByText("Conversations per Organization")).toBeInTheDocument();
    expect(screen.getByText("Members per Organization")).toBeInTheDocument();
    expect(screen.getByText("Member Role Distribution")).toBeInTheDocument();
  });

  it("renders descriptions", () => {
    render(<OrgActivitySection data={mockData} />);
    expect(screen.getByText("Total conversations broken down by org")).toBeInTheDocument();
    expect(screen.getByText("Team size across organizations")).toBeInTheDocument();
    expect(screen.getByText("Role breakdown across all organizations")).toBeInTheDocument();
  });
});
