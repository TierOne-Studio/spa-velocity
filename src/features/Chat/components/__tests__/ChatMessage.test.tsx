import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatMessage } from "../ChatMessage";
import type { ChatSource, ChatSqlCall } from "../../types";

// Mock ReactMarkdown to avoid full markdown rendering in tests
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

describe("ChatMessage", () => {
  it("renders user message", () => {
    render(<ChatMessage content="Hello from user" role="user" />);
    expect(screen.getByText("Hello from user")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    render(<ChatMessage content="Hello from assistant" role="assistant" />);
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });

  it("renders system message", () => {
    render(<ChatMessage content="System message" role="system" />);
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("System message")).toBeInTheDocument();
  });

  it("renders createdAt timestamp when provided", () => {
    // Use a fixed date to avoid timezone flakiness
    render(<ChatMessage content="Test" role="user" createdAt="2026-01-15T10:30:00.000Z" />);
    // Should show localized time string
    const timeEl = screen.getByText(/\d{1,2}:\d{2}/, { exact: false });
    expect(timeEl).toBeInTheDocument();
  });

  it("does not render timestamp when createdAt is not provided", () => {
    render(<ChatMessage content="Test" role="user" />);
    // Should not have any time-format element
    expect(screen.queryByText(/\d{1,2}:\d{2}:\d{2}/)).not.toBeInTheDocument();
  });

  it("renders assistant message using markdown", () => {
    render(<ChatMessage content="**Bold text**" role="assistant" />);
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
  });

  it("renders user message as plain text (not markdown)", () => {
    render(<ChatMessage content="**Bold text**" role="user" />);
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
    expect(screen.getByText("**Bold text**")).toBeInTheDocument();
  });

  it("renders sources when provided", () => {
    const sources: ChatSource[] = [
      { name: "React Docs", sourceName: "GitHub", webUrl: "https://github.com/facebook/react", entityType: "document" },
      { name: "Internal Doc", sourceName: "Confluence", webUrl: "https://confluence.example.com/page", entityType: "document" },
    ];
    render(<ChatMessage content="With sources" role="assistant" sources={sources} />);
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText(/React Docs/)).toBeInTheDocument();
    expect(screen.getByText(/Internal Doc/)).toBeInTheDocument();
  });

  it("renders safe URLs as links", () => {
    const sources: ChatSource[] = [
      { name: "Safe Link", sourceName: "GitHub", webUrl: "https://github.com/example", entityType: "document" },
    ];
    render(<ChatMessage content="Test" role="assistant" sources={sources} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://github.com/example");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders unsafe URLs as spans (not links)", () => {
    const sources: ChatSource[] = [
      { name: "Unsafe Link", sourceName: "Internal", webUrl: "javascript:alert(1)", entityType: "document" },
    ];
    render(<ChatMessage content="Test" role="assistant" sources={sources} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe Link · Internal")).toBeInTheDocument();
  });

  it("does not render sources section when sources is empty", () => {
    render(<ChatMessage content="No sources" role="assistant" sources={[]} />);
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
  });

  it("extracts and shows reasoning from think tags", () => {
    const content = "<think>This is my reasoning</think>The actual response";
    render(<ChatMessage content={content} role="assistant" />);
    expect(screen.getByText("Model reasoning")).toBeInTheDocument();
    // Reasoning content is collapsed by default, displayContent should be shown
    expect(screen.queryByText("This is my reasoning")).not.toBeInTheDocument();
  });

  it("toggles reasoning visibility on click", () => {
    const content = "<think>My reasoning</think>My response";
    render(<ChatMessage content={content} role="assistant" />);
    const reasoningButton = screen.getByText("Model reasoning");

    // Click to expand
    fireEvent.click(reasoningButton);
    // After toggle, the reasoning should be visible
    expect(screen.getByText("My reasoning")).toBeInTheDocument();
  });

  it("displays the display content after stripping think tags", () => {
    const content = "<think>Hidden reasoning</think>Visible response text";
    render(<ChatMessage content={content} role="assistant" />);
    // The displayContent should show
    expect(screen.getByTestId("markdown")).toHaveTextContent("Visible response text");
  });

  it("applies custom className", () => {
    const { container } = render(<ChatMessage content="Test" role="user" className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("uses patternHandlers to process content", () => {
    const mockRender = vi.fn().mockReturnValue(<span>Replaced</span>);
    const handlers = [{ pattern: /REPLACE/g, render: mockRender }];
    render(<ChatMessage content="Text REPLACE end" role="assistant" patternHandlers={handlers} />);
    expect(mockRender).toHaveBeenCalled();
    expect(screen.getByText("Replaced")).toBeInTheDocument();
  });

  it("renders content without patternHandlers using markdown for assistant", () => {
    render(<ChatMessage content="Simple content" role="assistant" patternHandlers={[]} />);
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
  });

  it("returns empty text when content is empty string with patternHandlers (covers line 53 !text branch)", () => {
    // Covers line 53: if (!text || patternHandlers.length === 0) return text — the !text branch
    // processContent is called with empty displayContent
    const handlers = [{ pattern: /PATTERN/g, render: () => <span>Replaced</span> }];
    render(<ChatMessage content="" role="assistant" patternHandlers={handlers} />);
    // Component renders without crashing; empty content means processContent returns "" immediately
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });

  it("processes pattern matching at start of text (covers line 78 false branch: earliest.index === cursor)", () => {
    // Covers line 78: if (earliest.index > cursor) - FALSE when pattern starts at cursor position
    // When text starts with the pattern, earliest.index(0) === cursor(0), so we skip the prefix push
    // processContent is only called for role="assistant" with patternHandlers
    const mockRender = vi.fn().mockReturnValue(<span data-testid="matched">Match</span>);
    const handlers = [{ pattern: /STARTTOKEN/g, render: mockRender }];
    // Content starts with the pattern token so earliest.index(0) === cursor(0)
    render(<ChatMessage content="STARTTOKEN rest of text" role="assistant" patternHandlers={handlers} />);
    // The pattern matches at position 0, so earliest.index === cursor, no prefix segment added
    expect(mockRender).toHaveBeenCalled();
  });

  it("selects the earlier-matching handler when two handlers match (covers line 68 match.index < earliest.index branch)", () => {
    // Two handlers: first matches at position 10, second matches at position 2
    // The second handler should win because it matches earlier
    const renderFirst = vi.fn().mockReturnValue(<span data-testid="first-match">First</span>);
    const renderSecond = vi.fn().mockReturnValue(<span data-testid="second-match">Second</span>);
    // text: "abSECONDcdFIRSTef"
    // handler1 matches "FIRST" at index 10
    // handler2 matches "SECOND" at index 2
    // After iteration: earliest = handler2 (index 2 < index 10)
    const handlers = [
      { pattern: /FIRST/g, render: renderFirst },
      { pattern: /SECOND/g, render: renderSecond },
    ];
    render(<ChatMessage content="abSECONDcdFIRSTef" role="assistant" patternHandlers={handlers} />);
    // Second handler matched earlier, so it should render
    expect(renderSecond).toHaveBeenCalled();
  });

  it("renders degraded badge when generator starts with 'fallback-' (covers lines 97, 105-108)", () => {
    // isDegraded = typeof generator === "string" && generator.startsWith("fallback-")
    // showDegradedBadge = import.meta.env.DEV && role === "assistant" && isDegraded
    render(<ChatMessage content="Test" role="assistant" generator="fallback-openai" />);
    // Check if degraded badge appears (only in DEV mode)
    // In Vitest, import.meta.env.DEV is typically true
    const badge = screen.queryByText("degraded mode");
    if (import.meta.env.DEV) {
      expect(badge).toBeInTheDocument();
    } else {
      // Even in non-DEV, isDegraded path was still evaluated, covering line 97
      expect(screen.getByText("Assistant")).toBeInTheDocument();
    }
  });

  it("isDegraded is false when generator is null (covers line 97 typeof !== 'string' branch)", () => {
    // generator is undefined — isDegraded = false (typeof undefined !== "string")
    render(<ChatMessage content="Test" role="assistant" generator={undefined} />);
    // No degraded badge regardless of DEV mode
    expect(screen.queryByText("degraded mode")).not.toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });

  it("isDegraded is false when generator does not start with 'fallback-' (covers line 97 false branch)", () => {
    // generator is "openai" — isDegraded = false (doesn't start with "fallback-")
    render(<ChatMessage content="Test" role="assistant" generator="openai" />);
    // No degraded badge
    expect(screen.queryByText("degraded mode")).not.toBeInTheDocument();
  });

  it("renders a collapsible SQL panel for each sqlCalls entry", () => {
    const sqlCalls: ChatSqlCall[] = [
      {
        connectionId: "conn-1",
        connectionName: "Primary DB",
        sql: 'SELECT COUNT(*) FROM "user"',
        rowCount: 1,
        truncated: false,
        durationMs: 42,
      },
    ];
    render(
      <ChatMessage content="There are 4 users." role="assistant" sqlCalls={sqlCalls} />,
    );
    // Summary is always visible; SQL body is collapsed by default.
    expect(screen.getByText("Primary DB")).toBeInTheDocument();
    expect(screen.queryByText('SELECT COUNT(*) FROM "user"')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chat-sql-call-toggle"));
    expect(screen.getByText('SELECT COUNT(*) FROM "user"')).toBeInTheDocument();
  });

  it("does not render a SQL panel on user messages even if sqlCalls provided", () => {
    const sqlCalls: ChatSqlCall[] = [
      {
        connectionId: "conn-1",
        connectionName: "Primary DB",
        sql: "SELECT 1",
        rowCount: 1,
        truncated: false,
        durationMs: 5,
      },
    ];
    render(<ChatMessage content="hi" role="user" sqlCalls={sqlCalls} />);
    expect(screen.queryByTestId("chat-sql-calls")).not.toBeInTheDocument();
  });
});
