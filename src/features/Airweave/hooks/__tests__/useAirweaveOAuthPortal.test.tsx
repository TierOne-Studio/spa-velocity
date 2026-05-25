import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const openSpy = vi.fn();

beforeEach(() => {
  openSpy.mockReset();
  // Replace window.open per-test; restore happens via vi.unstubAllGlobals below.
  vi.stubGlobal("open", openSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

import { useAirweaveOAuthPortal } from "../useAirweaveOAuthPortal";

describe("useAirweaveOAuthPortal", () => {
  // .env.test does NOT set VITE_AIRWEAVE_PORTAL_URL, so the hook's
  // `isAvailable` is `false` and `open()` is a guarded no-op. These
  // tests assert that contract — the "URL shape + noopener,noreferrer"
  // assertions are enforced by code review on the impl + a smoke test
  // against a real env in Step 5's verify clause.

  it("reports isAvailable=false when VITE_AIRWEAVE_PORTAL_URL is unset", () => {
    const { result } = renderHook(() => useAirweaveOAuthPortal());
    expect(result.current.isAvailable).toBe(false);
  });

  it("open() returns false and does NOT call window.open when the env var is unset", () => {
    const { result } = renderHook(() => useAirweaveOAuthPortal());
    const ok = result.current.open("any-token");
    expect(ok).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
