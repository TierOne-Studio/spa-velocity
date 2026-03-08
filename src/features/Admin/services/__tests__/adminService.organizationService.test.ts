import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchWithAuth, mockOrganization } = vi.hoisted(() => ({
  mockFetchWithAuth: vi.fn(),
  mockOrganization: {
    getFullOrganization: vi.fn(),
    update: vi.fn(),
    checkSlug: vi.fn(),
    setActive: vi.fn(),
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
    getInvitation: vi.fn(),
    listUserInvitations: vi.fn(),
    getActiveMember: vi.fn(),
    getActiveMemberRole: vi.fn(),
    leave: vi.fn(),
  },
}));

vi.mock("@shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: mockFetchWithAuth,
}));

vi.mock("@shared/lib/auth-client", () => ({
  admin: {},
  organization: mockOrganization,
}));

import { organizationService } from "../adminService";

const okJson = (data: unknown) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errJson = (message: string, status = 400) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ message }),
});

describe("organizationService.listOrganizations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches all orgs with no params", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }));

    const result = await organizationService.listOrganizations();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/platform-admin/organizations"),
    );
    expect(result.total).toBe(0);
  });

  it("appends page, limit, search params when provided — covers if(params.page) branches", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({ data: [], total: 0, page: 2, limit: 5, totalPages: 0 }));

    await organizationService.listOrganizations({ page: 2, limit: 5, search: "acme" });

    const url = mockFetchWithAuth.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("limit=5");
    expect(url).toContain("search=acme");
  });

  it("throws on error response — covers !response.ok branch", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Forbidden"));

    await expect(organizationService.listOrganizations()).rejects.toThrow("Forbidden");
  });

  it("throws fallback message when error has no message", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(organizationService.listOrganizations()).rejects.toThrow("Failed to list organizations");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(organizationService.listOrganizations()).rejects.toThrow("Failed to list organizations");
  });
});

describe("organizationService.createOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws on error response — covers !response.ok branch", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Slug already taken"));

    await expect(organizationService.createOrganization({ name: "X", slug: "x" })).rejects.toThrow("Slug already taken");
  });

  it("throws fallback message when error has no message", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(organizationService.createOrganization({ name: "X", slug: "x" })).rejects.toThrow("Failed to create organization");
  });
});


describe("organizationService.getOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns org data on success", async () => {
    mockOrganization.getFullOrganization.mockResolvedValue({ data: { id: "org-1" }, error: null });

    const result = await organizationService.getOrganization("org-1");
    expect(result).toEqual({ id: "org-1" });
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.getFullOrganization.mockResolvedValue({ data: null, error: { message: "Not found" } });

    await expect(organizationService.getOrganization("missing")).rejects.toThrow("Not found");
  });

  it("throws fallback message when error has no message", async () => {
    mockOrganization.getFullOrganization.mockResolvedValue({ data: null, error: {} });

    await expect(organizationService.getOrganization("missing")).rejects.toThrow("Failed to get organization");
  });
});

describe("organizationService.updateOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns updated org on success", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({ data: { id: "org-1", name: "Updated" } }));

    const result = await organizationService.updateOrganization("org-1", { name: "Updated" });
    expect(result).toEqual({ id: "org-1", name: "Updated" });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/platform-admin/organizations/org-1"),
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Update failed"));

    await expect(organizationService.updateOrganization("org-1", { name: "X" })).rejects.toThrow("Update failed");
  });

  it("throws fallback message when error has no message", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(organizationService.updateOrganization("org-1", {})).rejects.toThrow("Failed to update organization");
  });

  it("throws fallback when json parse fails", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(organizationService.updateOrganization("org-1", { name: "X" })).rejects.toThrow(
      "Failed to update organization",
    );
  });
});

describe("organizationService.deleteOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds on ok response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(organizationService.deleteOrganization("org-1")).resolves.toBeUndefined();
  });

  it("throws on error response — covers !response.ok branch", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Cannot delete"));

    await expect(organizationService.deleteOrganization("org-1")).rejects.toThrow("Cannot delete");
  });

  it("throws fallback message when error has no message", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(organizationService.deleteOrganization("org-1")).rejects.toThrow("Failed to delete organization");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(organizationService.deleteOrganization("org-1")).rejects.toThrow("Failed to delete organization");
  });
});

describe("organizationService.listMembers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns members array on success", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({ data: [{ id: "m-1" }] }));

    const result = await organizationService.listMembers("org-1");
    expect(result).toEqual([{ id: "m-1" }]);
  });

  it("returns empty array when data is null — covers data ?? [] branch", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({}));

    const result = await organizationService.listMembers("org-1");
    expect(result).toEqual([]);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Forbidden"));

    await expect(organizationService.listMembers("org-1")).rejects.toThrow("Forbidden");
  });
});

describe("organizationService.addMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns member data on success", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({ data: { id: "m-1" } }));

    const result = await organizationService.addMember("org-1", "user-1", "member");
    expect(result).toEqual({ id: "m-1" });
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Role escalation forbidden"));

    await expect(organizationService.addMember("org-1", "user-1", "admin")).rejects.toThrow("Role escalation forbidden");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(organizationService.addMember("org-1", "u-1", "member")).rejects.toThrow("Failed to add member");
  });
});

describe("organizationService.inviteMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invitation data on success", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({ data: { id: "inv-1" } }));

    const result = await organizationService.inviteMember({ organizationId: "org-1", email: "a@b.com", role: "member" });
    expect(result).toEqual({ id: "inv-1" });
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Already a member"));

    await expect(organizationService.inviteMember({ organizationId: "org-1", email: "a@b.com", role: "member" })).rejects.toThrow("Already a member");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(
      organizationService.inviteMember({ organizationId: "org-1", email: "a@b.com", role: "member" }),
    ).rejects.toThrow("Failed to invite member");
  });
});

describe("organizationService.removeMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds on ok response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(organizationService.removeMember({ organizationId: "org-1", memberId: "m-1" })).resolves.toBeUndefined();
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Cannot remove last admin"));

    await expect(organizationService.removeMember({ organizationId: "org-1", memberId: "m-1" })).rejects.toThrow("Cannot remove last admin");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(
      organizationService.removeMember({ organizationId: "org-1", memberId: "m-1" }),
    ).rejects.toThrow("Failed to remove member");
  });
});

describe("organizationService.updateMemberRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds on ok response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(organizationService.updateMemberRole({ organizationId: "org-1", memberId: "m-1", role: "manager" })).resolves.toBeUndefined();
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Role update failed"));

    await expect(organizationService.updateMemberRole({ organizationId: "org-1", memberId: "m-1", role: "member" })).rejects.toThrow("Role update failed");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(
      organizationService.updateMemberRole({ organizationId: "org-1", memberId: "m-1", role: "member" }),
    ).rejects.toThrow("Failed to update member role");
  });
});

describe("organizationService.listInvitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invitations array on success", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({ data: [{ id: "inv-1" }] }));

    const result = await organizationService.listInvitations("org-1");
    expect(result).toEqual([{ id: "inv-1" }]);
  });

  it("returns empty array when data is null — covers data ?? [] branch", async () => {
    mockFetchWithAuth.mockResolvedValue(okJson({}));

    const result = await organizationService.listInvitations("org-1");
    expect(result).toEqual([]);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Forbidden"));

    await expect(organizationService.listInvitations("org-1")).rejects.toThrow("Forbidden");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(organizationService.listInvitations("org-1")).rejects.toThrow("Failed to list invitations");
  });
});

describe("organizationService.cancelInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds on ok response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(organizationService.cancelInvitation({ organizationId: "org-1", invitationId: "inv-1" })).resolves.toBeUndefined();
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Invitation not found"));

    await expect(organizationService.cancelInvitation({ organizationId: "org-1", invitationId: "inv-1" })).rejects.toThrow("Invitation not found");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(
      organizationService.cancelInvitation({ organizationId: "org-1", invitationId: "inv-1" }),
    ).rejects.toThrow("Failed to cancel invitation");
  });
});

describe("organizationService.deleteInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds on ok response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(organizationService.deleteInvitation("org-1", "inv-1")).resolves.toBeUndefined();
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue(errJson("Not found"));

    await expect(organizationService.deleteInvitation("org-1", "inv-1")).rejects.toThrow("Not found");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(organizationService.deleteInvitation("org-1", "inv-1")).rejects.toThrow("Failed to delete invitation");
  });
});

describe("organizationService.checkSlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns data on success", async () => {
    mockOrganization.checkSlug.mockResolvedValue({ data: { available: true }, error: null });

    const result = await organizationService.checkSlug("my-org");
    expect(result).toEqual({ available: true });
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.checkSlug.mockResolvedValue({ data: null, error: { message: "Check failed" } });

    await expect(organizationService.checkSlug("bad-slug")).rejects.toThrow("Check failed");
  });
});

describe("organizationService.setActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds when no error", async () => {
    mockOrganization.setActive.mockResolvedValue({ error: null });

    await expect(organizationService.setActive("org-1")).resolves.toBeUndefined();
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.setActive.mockResolvedValue({ error: { message: "Set active failed" } });

    await expect(organizationService.setActive("org-1")).rejects.toThrow("Set active failed");
  });
});

describe("organizationService.acceptInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns data on success", async () => {
    mockOrganization.acceptInvitation.mockResolvedValue({ data: { id: "inv-1" }, error: null });

    const result = await organizationService.acceptInvitation("inv-1");
    expect(result).toEqual({ id: "inv-1" });
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.acceptInvitation.mockResolvedValue({ data: null, error: { message: "Invitation expired" } });

    await expect(organizationService.acceptInvitation("inv-1")).rejects.toThrow("Invitation expired");
  });
});

describe("organizationService.rejectInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds when no error", async () => {
    mockOrganization.rejectInvitation.mockResolvedValue({ error: null });

    await expect(organizationService.rejectInvitation("inv-1")).resolves.toBeUndefined();
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.rejectInvitation.mockResolvedValue({ error: { message: "Reject failed" } });

    await expect(organizationService.rejectInvitation("inv-1")).rejects.toThrow("Reject failed");
  });
});

describe("organizationService.getInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invitation data on success", async () => {
    mockOrganization.getInvitation.mockResolvedValue({ data: { id: "inv-1" }, error: null });

    const result = await organizationService.getInvitation("inv-1");
    expect(result).toEqual({ id: "inv-1" });
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.getInvitation.mockResolvedValue({ data: null, error: { message: "Not found" } });

    await expect(organizationService.getInvitation("inv-1")).rejects.toThrow("Not found");
  });
});

describe("organizationService.listUserInvitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invitations on success", async () => {
    mockOrganization.listUserInvitations.mockResolvedValue({ data: [{ id: "inv-1" }], error: null });

    const result = await organizationService.listUserInvitations();
    expect(result).toEqual([{ id: "inv-1" }]);
  });

  it("returns empty array when data is null — covers data ?? [] branch", async () => {
    mockOrganization.listUserInvitations.mockResolvedValue({ data: null, error: null });

    const result = await organizationService.listUserInvitations();
    expect(result).toEqual([]);
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.listUserInvitations.mockResolvedValue({ data: null, error: { message: "List failed" } });

    await expect(organizationService.listUserInvitations()).rejects.toThrow("List failed");
  });
});

describe("organizationService.getActiveMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active member on success", async () => {
    mockOrganization.getActiveMember.mockResolvedValue({ data: { id: "m-1", role: "admin" }, error: null });

    const result = await organizationService.getActiveMember();
    expect(result).toEqual({ id: "m-1", role: "admin" });
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.getActiveMember.mockResolvedValue({ data: null, error: { message: "No active org" } });

    await expect(organizationService.getActiveMember()).rejects.toThrow("No active org");
  });
});

describe("organizationService.getActiveMemberRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active member role on success", async () => {
    mockOrganization.getActiveMemberRole.mockResolvedValue({ data: { role: "manager" }, error: null });

    const result = await organizationService.getActiveMemberRole();
    expect(result).toEqual({ role: "manager" });
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.getActiveMemberRole.mockResolvedValue({ data: null, error: { message: "Role fetch failed" } });

    await expect(organizationService.getActiveMemberRole()).rejects.toThrow("Role fetch failed");
  });
});

describe("organizationService.leaveOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds when no error", async () => {
    mockOrganization.leave.mockResolvedValue({ error: null });

    await expect(organizationService.leaveOrganization("org-1")).resolves.toBeUndefined();
  });

  it("throws on error — covers if(error) branch", async () => {
    mockOrganization.leave.mockResolvedValue({ error: { message: "Cannot leave" } });

    await expect(organizationService.leaveOrganization("org-1")).rejects.toThrow("Cannot leave");
  });
});
