import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));

import { EmbedCodeDialog, buildEmbedSnippet } from "../EmbedCodeDialog";
import type { EmbedSite } from "../../types";

const site: EmbedSite = {
  id: "site-1",
  name: "Acme",
  projectId: "proj-1",
  publicKey: "wgt_pub_abc123",
  allowedOrigins: ["https://acme.com"],
  enabled: true,
  theme: null,
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z",
};

beforeEach(() => {
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("buildEmbedSnippet", () => {
  it("embeds the public key and points at the widget.js path", () => {
    const snippet = buildEmbedSnippet("wgt_pub_abc123", "https://api.example.com");
    expect(snippet).toContain('data-embed-key="wgt_pub_abc123"');
    expect(snippet).toContain("/api/public/widget/v1/widget.js");
    expect(snippet).toContain('data-api-base="https://api.example.com"');
  });

  it("omits data-theme when no theme is given (backward compatible)", () => {
    expect(buildEmbedSnippet("wgt_pub_abc123")).not.toContain("data-theme");
  });

  it("appends data-theme when a theme id is given", () => {
    const snippet = buildEmbedSnippet(
      "wgt_pub_abc123",
      "https://api.example.com",
      "obsidian",
    );
    expect(snippet).toContain('data-theme="obsidian"');
  });

  it("formats the snippet as multiline with one attribute per indented line", () => {
    const lines = buildEmbedSnippet(
      "wgt_pub_abc123",
      "https://api.example.com",
      "obsidian",
    ).split("\n");
    expect(lines[0]).toBe("<script");
    expect(lines).toContain(
      '  src="https://api.example.com/api/public/widget/v1/widget.js"',
    );
    expect(lines).toContain('  data-embed-key="wgt_pub_abc123"');
    expect(lines).toContain('  data-api-base="https://api.example.com"');
    expect(lines).toContain('  data-theme="obsidian"');
    expect(lines[lines.length - 1]).toBe("></script>");
  });

  it("drops the data-theme line entirely when no theme is given", () => {
    const lines = buildEmbedSnippet("wgt_pub_abc123").split("\n");
    expect(lines.some((l) => l.includes("data-theme"))).toBe(false);
    expect(lines[lines.length - 1]).toBe("></script>");
  });
});

describe("EmbedCodeDialog", () => {
  it("renders the snippet containing the public key", () => {
    render(<EmbedCodeDialog site={site} open onOpenChange={() => {}} />);
    expect(screen.getByTestId("embed-snippet").textContent).toContain(
      "wgt_pub_abc123",
    );
  });

  it("defaults to the cloud theme and reflects it in the snippet", () => {
    render(<EmbedCodeDialog site={site} open onOpenChange={() => {}} />);
    expect(screen.getByTestId("embed-snippet").textContent).toContain(
      'data-theme="cloud"',
    );
  });

  it("offers all four themes and updates the snippet + preview when one is picked", async () => {
    render(<EmbedCodeDialog site={site} open onOpenChange={() => {}} />);
    for (const label of ["Cloud", "Obsidian", "Neo Brutalism", "Mono Chrome"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("radio", { name: "Obsidian" }));

    expect(screen.getByTestId("embed-snippet").textContent).toContain(
      'data-theme="obsidian"',
    );
    expect(
      screen.getByRole("img", { name: /obsidian theme preview/i }),
    ).toBeInTheDocument();
  });

  it("copies the snippet to the clipboard and toasts success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<EmbedCodeDialog site={site} open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /copy embed code/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("wgt_pub_abc123");
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("toasts an error fallback when the clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    render(<EmbedCodeDialog site={site} open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /copy embed code/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });
});
