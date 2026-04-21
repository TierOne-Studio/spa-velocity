import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseOrgCapabilities = vi.fn();

vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => mockUseOrgCapabilities(),
}));

import { ViewingScopePicker } from "../ViewingScopePicker";
import { ALL_ORGANIZATIONS_VALUE } from "@/shared/constants/org-scope";

function capabilities(overrides: Record<string, unknown> = {}) {
  return {
    isSuperadmin: false,
    isMultiOrgMember: false,
    isSingleOrgMember: false,
    memberOrganizations: [],
    activeOrganizationId: null,
    isLoading: false,
    ...overrides,
  };
}

describe("ViewingScopePicker", () => {
  beforeEach(() => {
    mockUseOrgCapabilities.mockReset();
  });

  it("renders nothing for non-superadmin callers", () => {
    mockUseOrgCapabilities.mockReturnValue(capabilities({ isSuperadmin: false }));

    const { container } = render(
      <ViewingScopePicker
        value={null}
        onChange={vi.fn()}
        organizations={[{ id: "org-1", name: "Acme" }]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the trigger for superadmin callers", () => {
    mockUseOrgCapabilities.mockReturnValue(capabilities({ isSuperadmin: true }));

    render(
      <ViewingScopePicker
        value={ALL_ORGANIZATIONS_VALUE}
        onChange={vi.fn()}
        organizations={[{ id: "org-1", name: "Acme" }]}
      />,
    );

    expect(screen.getByTestId("viewing-scope-picker")).toBeInTheDocument();
  });

  it("shows the selected org name for superadmin", () => {
    mockUseOrgCapabilities.mockReturnValue(capabilities({ isSuperadmin: true }));

    render(
      <ViewingScopePicker
        value="org-1"
        onChange={vi.fn()}
        organizations={[
          { id: "org-1", name: "Acme" },
          { id: "org-2", name: "Globex" },
        ]}
      />,
    );

    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows the 'All organizations' value when selected", () => {
    mockUseOrgCapabilities.mockReturnValue(capabilities({ isSuperadmin: true }));

    render(
      <ViewingScopePicker
        value={ALL_ORGANIZATIONS_VALUE}
        onChange={vi.fn()}
        organizations={[{ id: "org-1", name: "Acme" }]}
      />,
    );

    expect(screen.getByText("All organizations")).toBeInTheDocument();
  });

  it("renders the placeholder when no value is selected", () => {
    mockUseOrgCapabilities.mockReturnValue(capabilities({ isSuperadmin: true }));

    render(
      <ViewingScopePicker
        value={null}
        onChange={vi.fn()}
        organizations={[]}
        placeholder="Pick an org"
      />,
    );

    expect(screen.getByText("Pick an org")).toBeInTheDocument();
  });

  it("honors a custom testId", () => {
    mockUseOrgCapabilities.mockReturnValue(capabilities({ isSuperadmin: true }));

    render(
      <ViewingScopePicker
        value={null}
        onChange={vi.fn()}
        organizations={[]}
        testId="scope-filter"
      />,
    );

    expect(screen.getByTestId("scope-filter")).toBeInTheDocument();
  });
});
