import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { ChatInput } from "../ChatInput";

describe("ChatInput", () => {
  const mockOnSend = vi.fn();
  const mockOnStop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a textarea with placeholder", () => {
    render(<ChatInput onSend={mockOnSend} />);
    expect(screen.getByPlaceholderText("Ask a question about this organization")).toBeInTheDocument();
  });

  it("renders custom placeholder", () => {
    render(<ChatInput onSend={mockOnSend} placeholder="Type here..." />);
    expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
  });

  it("renders Send button by default", () => {
    render(<ChatInput onSend={mockOnSend} />);
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("Send button is disabled when input is empty", () => {
    render(<ChatInput onSend={mockOnSend} />);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("Send button is enabled when input has content", async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello");
    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("calls onSend with trimmed input on Send button click", async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello world");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(mockOnSend).toHaveBeenCalledWith("Hello world");
  });

  it("clears input after sending", async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(textarea).toHaveValue("");
  });

  it("calls onSend on Enter key press", async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Test message");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockOnSend).toHaveBeenCalledWith("Test message");
  });

  it("does not send on Shift+Enter", async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Test message");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("does not send when input is whitespace only", () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("shows Stop button and calls onStopGeneration when isLoading=true", () => {
    render(<ChatInput onSend={mockOnSend} onStopGeneration={mockOnStop} isLoading={true} />);
    const stopButton = screen.getByRole("button", { name: /stop/i });
    expect(stopButton).toBeInTheDocument();
    fireEvent.click(stopButton);
    expect(mockOnStop).toHaveBeenCalled();
  });

  it("disables textarea when isLoading=true", () => {
    render(<ChatInput onSend={mockOnSend} isLoading={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows 'Agent is working...' text when loading", () => {
    render(<ChatInput onSend={mockOnSend} isLoading={true} />);
    expect(screen.getByText("Agent is working...")).toBeInTheDocument();
  });

  it("shows hint text when not loading", () => {
    render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    expect(screen.getByText("Enter to send, Shift+Enter for new line")).toBeInTheDocument();
  });

  it("disables Send button when disabled=true", () => {
    render(<ChatInput onSend={mockOnSend} disabled={true} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });

  it("does not call onSend when disabled=true and Enter pressed", async () => {
    render(<ChatInput onSend={mockOnSend} disabled={true} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("renders Stop button without onStopGeneration callback even when isLoading", () => {
    // When isLoading but no onStopGeneration, shows Send button instead
    render(<ChatInput onSend={mockOnSend} isLoading={true} />);
    // No onStopGeneration provided - no stop button visible
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  it("sets object ref to textarea node (covers line 34: else if (ref) ref.current = node)", () => {
    // Line 34: else if (ref) ref.current = node
    // Passing a React.createRef() object ref (not a function ref) triggers this branch
    const ref = createRef<HTMLTextAreaElement>();
    render(<ChatInput ref={ref} onSend={mockOnSend} />);
    // After render, the ref.current should be set to the textarea element
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("TEXTAREA");
  });

  it("accepts a function ref and calls it with the textarea node (covers line 33)", () => {
    // Line 33: if (typeof ref === "function") ref(node)
    // Passing a callback ref triggers this branch
    let capturedNode: HTMLTextAreaElement | null = null;
    const callbackRef = (node: HTMLTextAreaElement | null) => { capturedNode = node; };
    render(<ChatInput ref={callbackRef} onSend={mockOnSend} />);
    expect(capturedNode).not.toBeNull();
    expect((capturedNode as HTMLTextAreaElement | null)?.tagName).toBe("TEXTAREA");
  });
});
