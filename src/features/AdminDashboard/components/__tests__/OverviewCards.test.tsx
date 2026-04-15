import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverviewCards } from "../OverviewCards";
import type { OverviewStatsDto } from "../../types/adminDashboard.types";

const mockData: OverviewStatsDto = {
  totalUsers: 100,
  bannedUsers: 3,
  activeSessions: 42,
  totalOrganizations: 5,
  totalConversations: 200,
  totalMessages: 1500,
  assistantMessages: 750,
  totalTokensAllTime: 99999,
};

describe("OverviewCards", () => {
  it("renders loading skeletons when isLoading is true", () => {
    render(<OverviewCards isLoading={true} />);
    // There should be multiple skeleton elements in loading state
    const allDivs = document.querySelectorAll("div");
    expect(allDivs.length).toBeGreaterThan(0);
    // The loading state shows 4 card skeletons - no card titles
    expect(screen.queryByText("Total Users")).not.toBeInTheDocument();
  });

  it("renders all four KPI cards when not loading", () => {
    render(<OverviewCards data={mockData} isLoading={false} />);

    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("AI Tokens Used")).toBeInTheDocument();
  });

  it("displays correct values from data", () => {
    render(<OverviewCards data={mockData} isLoading={false} />);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("99,999")).toBeInTheDocument();
  });

  it("renders subtitles with correct data", () => {
    render(<OverviewCards data={mockData} isLoading={false} />);

    expect(screen.getByText("3 banned")).toBeInTheDocument();
    expect(screen.getByText("5 orgs")).toBeInTheDocument();
    expect(screen.getByText("1,500 messages total")).toBeInTheDocument();
    expect(screen.getByText("tracked since deployment")).toBeInTheDocument();
  });

  it("shows dash when totalTokensAllTime is null", () => {
    const dataWithoutTokens: OverviewStatsDto = { ...mockData, totalTokensAllTime: null };
    render(<OverviewCards data={dataWithoutTokens} isLoading={false} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("defaults to zero values when data is undefined", () => {
    render(<OverviewCards isLoading={false} />);

    // Should render 0 for numeric fields
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThan(0);
  });

  it("handles zero values correctly", () => {
    const zeroData: OverviewStatsDto = {
      totalUsers: 0,
      bannedUsers: 0,
      activeSessions: 0,
      totalOrganizations: 0,
      totalConversations: 0,
      totalMessages: 0,
      assistantMessages: 0,
      totalTokensAllTime: null,
    };
    render(<OverviewCards data={zeroData} isLoading={false} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("0 banned")).toBeInTheDocument();
  });
});
