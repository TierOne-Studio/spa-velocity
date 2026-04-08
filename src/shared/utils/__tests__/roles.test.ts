import { describe, expect, it } from "vitest";
import { isSuperadminRole, getActiveOrganizationId, getSessionUserRole } from "../roles";

describe("isSuperadminRole", () => {
  it("returns true for 'superadmin' string", () => {
    expect(isSuperadminRole("superadmin")).toBe(true);
  });

  it("returns false for 'admin' string", () => {
    expect(isSuperadminRole("admin")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSuperadminRole(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSuperadminRole(undefined)).toBe(false);
  });

  it("handles comma-separated string with superadmin", () => {
    expect(isSuperadminRole("superadmin,admin")).toBe(true);
  });

  it("returns false for comma-separated string without superadmin", () => {
    expect(isSuperadminRole("admin,manager")).toBe(false);
  });

  it("handles array with superadmin", () => {
    expect(isSuperadminRole(["superadmin", "admin"])).toBe(true);
  });

  it("returns false for array without superadmin", () => {
    expect(isSuperadminRole(["admin", "member"])).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSuperadminRole("")).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isSuperadminRole([])).toBe(false);
  });
});

describe("getActiveOrganizationId", () => {
  it("extracts activeOrganizationId from session", () => {
    expect(getActiveOrganizationId({ session: { activeOrganizationId: "org-1" } })).toBe("org-1");
  });

  it("returns null when session is null", () => {
    expect(getActiveOrganizationId(null)).toBeNull();
  });

  it("returns null when activeOrganizationId is missing", () => {
    expect(getActiveOrganizationId({ session: {} })).toBeNull();
  });
});

describe("getSessionUserRole", () => {
  it("extracts string role from session", () => {
    expect(getSessionUserRole({ user: { role: "admin" } })).toBe("admin");
  });

  it("extracts array role from session", () => {
    expect(getSessionUserRole({ user: { role: ["admin", "manager"] } })).toEqual(["admin", "manager"]);
  });

  it("returns undefined when session is null", () => {
    expect(getSessionUserRole(null)).toBeUndefined();
  });
});
