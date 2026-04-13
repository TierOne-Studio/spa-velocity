import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockOrganization } = vi.hoisted(() => ({
  mockOrganization: {
    getActiveMember: vi.fn(),
    getActiveMemberRole: vi.fn(),
    leave: vi.fn(),
  },
}));

const { mockFetchWithAuthInline } = vi.hoisted(() => ({
  mockFetchWithAuthInline: vi.fn(),
}));
vi.mock("@shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: mockFetchWithAuthInline,
  fetchApi: async (url: string, options?: RequestInit, fallbackMessage = "Request failed") => {
    const response = await mockFetchWithAuthInline(...[url, options].filter(v => v !== undefined));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || fallbackMessage);
    }
    if (response.status === 204) return undefined;
    return response.json();
  },
}));

vi.mock("@shared/lib/auth-client", () => ({
  admin: {},
  organization: mockOrganization,
}));

import { organizationService } from "../adminService";

describe("organizationService.getActiveMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns member data on success", async () => {
    const memberData = { id: "m-1", organizationId: "org-1", role: "admin" };
    mockOrganization.getActiveMember.mockResolvedValue({ data: memberData, error: null });

    const result = await organizationService.getActiveMember();

    expect(result).toEqual(memberData);
  });

  it("throws error message when getActiveMember returns error", async () => {
    mockOrganization.getActiveMember.mockResolvedValue({
      data: null,
      error: { message: "Not in an organization" },
    });

    await expect(organizationService.getActiveMember()).rejects.toThrow("Not in an organization");
  });

  it("throws fallback message when error has no message", async () => {
    mockOrganization.getActiveMember.mockResolvedValue({ data: null, error: {} });

    await expect(organizationService.getActiveMember()).rejects.toThrow("Failed to get active member");
  });
});

describe("organizationService.getActiveMemberRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns role data on success", async () => {
    const roleData = { role: "manager" };
    mockOrganization.getActiveMemberRole.mockResolvedValue({ data: roleData, error: null });

    const result = await organizationService.getActiveMemberRole();

    expect(result).toEqual(roleData);
  });

  it("throws error message when getActiveMemberRole returns error", async () => {
    mockOrganization.getActiveMemberRole.mockResolvedValue({
      data: null,
      error: { message: "No active organization" },
    });

    await expect(organizationService.getActiveMemberRole()).rejects.toThrow("No active organization");
  });

  it("throws fallback message when error has no message", async () => {
    mockOrganization.getActiveMemberRole.mockResolvedValue({ data: null, error: {} });

    await expect(organizationService.getActiveMemberRole()).rejects.toThrow("Failed to get active member role");
  });
});

describe("organizationService.leaveOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves without error on success", async () => {
    mockOrganization.leave.mockResolvedValue({ data: {}, error: null });

    await expect(organizationService.leaveOrganization("org-1")).resolves.toBeUndefined();
    expect(mockOrganization.leave).toHaveBeenCalledWith({ organizationId: "org-1" });
  });

  it("throws error message when leave returns error", async () => {
    mockOrganization.leave.mockResolvedValue({
      data: null,
      error: { message: "Cannot leave your only organization" },
    });

    await expect(organizationService.leaveOrganization("org-1")).rejects.toThrow(
      "Cannot leave your only organization",
    );
  });

  it("throws fallback message when error has no message", async () => {
    mockOrganization.leave.mockResolvedValue({ data: null, error: {} });

    await expect(organizationService.leaveOrganization("org-1")).rejects.toThrow(
      "Failed to leave organization",
    );
  });
});
