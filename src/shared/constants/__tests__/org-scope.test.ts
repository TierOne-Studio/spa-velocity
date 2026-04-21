import { describe, expect, it } from "vitest";

import {
  ALL_ORGANIZATIONS_VALUE,
  ORG_SCOPE_ALL_QUERY,
  isAllOrganizationsValue,
} from "../org-scope";

describe("org-scope constants", () => {
  it("exports the canonical all-organizations sentinel", () => {
    expect(ALL_ORGANIZATIONS_VALUE).toBe("__all__");
  });

  it("exports a query object matching the backend scope contract", () => {
    expect(ORG_SCOPE_ALL_QUERY).toEqual({ scope: "all" });
  });

  describe("isAllOrganizationsValue", () => {
    it("narrows the sentinel", () => {
      expect(isAllOrganizationsValue(ALL_ORGANIZATIONS_VALUE)).toBe(true);
    });

    it("rejects real org ids", () => {
      expect(isAllOrganizationsValue("org-123")).toBe(false);
    });

    it("rejects null and undefined", () => {
      expect(isAllOrganizationsValue(null)).toBe(false);
      expect(isAllOrganizationsValue(undefined)).toBe(false);
    });

    it("rejects similar-looking strings", () => {
      expect(isAllOrganizationsValue("__ALL__")).toBe(false);
      expect(isAllOrganizationsValue("all")).toBe(false);
      expect(isAllOrganizationsValue("")).toBe(false);
    });
  });
});
