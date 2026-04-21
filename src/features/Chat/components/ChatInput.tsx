import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { IconSend, IconPlayerStop } from "@tabler/icons-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";

export interface ChatInputProps {
  onSend: (message: string) => void;
  onStopGeneration?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      onSend,
      onStopGeneration,
      isLoading = false,
      placeholder = "Ask a question about this project",
      disabled = false,
      className,
    },
    ref,
  ) => {
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const mergedRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        if (node) {
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
          textareaRef.current = node;
        }
      },
      [ref],
    );

    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [input, adjustHeight]);

    const handleSend = useCallback(() => {
      const trimmed = input.trim();
      if (!trimmed || isLoading || disabled) return;
      onSend(trimmed);
      setInput("");
    }, [input, isLoading, disabled, onSend]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
      [handleSend],
    );

    return (
      <div className={cn("rounded-[1.75rem] border bg-background px-4 py-3 shadow-sm", className)}>
        <textarea
          ref={mergedRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="min-h-[28px] w-full resize-none bg-transparent text-sm leading-6 placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-3 pt-3">
          <div className="text-xs text-muted-foreground">
            {isLoading ? "Agent is working..." : "Enter to send, Shift+Enter for new line"}
          </div>
          <div className="flex items-center gap-2">
            {isLoading && onStopGeneration ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onStopGeneration}
                className="h-8 rounded-full"
              >
                <IconPlayerStop className="mr-1.5 h-3.5 w-3.5" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || disabled}
                className="h-8 rounded-full"
              >
                <IconSend className="mr-1.5 h-3.5 w-3.5" />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";
