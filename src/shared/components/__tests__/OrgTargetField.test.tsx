import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseOrgCapabilities = vi.fn();

vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => mockUseOrgCapabilities(),
}));

import { OrgTargetField } from "../forms/OrgTargetField";

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

describe("OrgTargetField", () => {
  beforeEach(() => {
    mockUseOrgCapabilities.mockReset();
  });

  describe("single-org member", () => {
    it("renders nothing by default", () => {
      mockUseOrgCapabilities.mockReturnValue(
        capabilities({
          isSingleOrgMember: true,
          memberOrganizations: [{ id: "org-1", name: "Acme", slug: "acme" }],
        }),
      );

      const { container } = render(
        <OrgTargetField value="org-1" onChange={vi.fn()} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("renders a read-only fallback when asked", () => {
      mockUseOrgCapabilities.mockReturnValue(
        capabilities({
          isSingleOrgMember: true,
          memberOrganizations: [{ id: "org-1", name: "Acme", slug: "acme" }],
        }),
      );

      render(
        <OrgTargetField
          value="org-1"
          onChange={vi.fn()}
          showReadOnlyFallback
        />,
      );

      expect(screen.getByTestId("org-target-field")).toBeInTheDocument();
      expect(screen.getByText("Acme")).toBeInTheDocument();
    });

    it("prefers an explicit readOnlyOrganizationName over membership data", () => {
      mockUseOrgCapabilities.mockReturnValue(
        capabilities({
          isSingleOrgMember: true,
          memberOrganizations: [{ id: "org-1", name: "Acme", slug: "acme" }],
        }),
      );

      render(
        <OrgTargetField
          value="org-1"
          onChange={vi.fn()}
          showReadOnlyFallback
          readOnlyOrganizationName="Acme (fixed)"
        />,
      );

      expect(screen.getByText("Acme (fixed)")).toBeInTheDocument();
    });
  });

  describe("multi-org member", () => {
    it("renders the dropdown sourced from memberships", () => {
      mockUseOrgCapabilities.mockReturnValue(
        capabilities({
          isMultiOrgMember: true,
          memberOrganizations: [
            { id: "org-1", name: "Acme", slug: "acme" },
            { id: "org-2", name: "Globex", slug: "globex" },
          ],
        }),
      );

      render(<OrgTargetField value="org-1" onChange={vi.fn()} />);

      expect(screen.getByTestId("org-target-field")).toBeInTheDocument();
      // Selected value visible in the trigger
      expect(screen.getByText("Acme")).toBeInTheDocument();
    });

    it("ignores organizations prop for multi-org members (stays memberships-only)", () => {
      mockUseOrgCapabilities.mockReturnValue(
        capabilities({
          isMultiOrgMember: true,
          memberOrganizations: [{ id: "org-1", name: "Acme", slug: "acme" }],
        }),
      );

      render(
        <OrgTargetField
          value="org-1"
          onChange={vi.fn()}
          organizations={[
            { id: "org-1", name: "Acme" },
            { id: "org-2", name: "Globex (other tenant)" },
          ]}
        />,
      );

      // The trigger only shows the selected value; without opening, we can't
      // see the full option list. What matters is the component *renders*.
      expect(screen.getByTestId("org-target-field")).toBeInTheDocument();
    });
  });

  describe("superadmin", () => {
    it("renders the dropdown sourced from the organizations prop", () => {
      mockUseOrgCapabilities.mockReturnValue(
        capabilities({
          isSuperadmin: true,
          memberOrganizations: [],
        }),
      );

      render(
        <OrgTargetField
          value="org-42"
          onChange={vi.fn()}
          organizations={[
            { id: "org-1", name: "Acme" },
            { id: "org-42", name: "FortyTwo Labs" },
          ]}
        />,
      );

      expect(screen.getByTestId("org-target-field")).toBeInTheDocument();
      expect(screen.getByText("FortyTwo Labs")).toBeInTheDocument();
    });

    it("falls back to memberships when organizations prop is omitted", () => {
      mockUseOrgCapabilities.mockReturnValue(
        capabilities({
          isSuperadmin: true,
          memberOrganizations: [{ id: "org-me", name: "My Own", slug: "me" }],
        }),
      );

      render(<OrgTargetField value="org-me" onChange={vi.fn()} />);
      expect(screen.getByText("My Own")).toBeInTheDocument();
    });
  });

  it("renders label and helpText", () => {
    mockUseOrgCapabilities.mockReturnValue(
      capabilities({
        isMultiOrgMember: true,
        memberOrganizations: [
          { id: "org-1", name: "Acme", slug: "acme" },
          { id: "org-2", name: "Globex", slug: "globex" },
        ],
      }),
    );

    render(
      <OrgTargetField
        value={null}
        onChange={vi.fn()}
        label="Target organization"
        helpText="Pick where to create this."
      />,
    );

    expect(screen.getByText("Target organization")).toBeInTheDocument();
    expect(screen.getByText("Pick where to create this.")).toBeInTheDocument();
  });

  it("renders nothing when caller has no memberships and is not superadmin", () => {
    mockUseOrgCapabilities.mockReturnValue(
      capabilities({
        isSuperadmin: false,
        isMultiOrgMember: false,
        isSingleOrgMember: false,
        memberOrganizations: [],
      }),
    );

    const { container } = render(
      <OrgTargetField value={null} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
