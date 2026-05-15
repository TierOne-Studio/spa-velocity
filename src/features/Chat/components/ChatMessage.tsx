import { useState, useMemo, useCallback } from "react";
import { cn } from "@/shared/lib/utils";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { Collapsible, CollapsibleContent } from "@/shared/components/ui/collapsible";
import { IconChevronDown, IconBrain, IconDatabase } from "@tabler/icons-react";
import { Separator } from "@/shared/components/ui/separator";
import type { ChatSource, ChatSqlCall } from "../types";

export interface PatternHandler {
  pattern: RegExp;
  render: (match: RegExpExecArray) => React.ReactNode;
}

export interface ChatMessageProps {
  content: string;
  role: "user" | "assistant" | "system";
  sources?: ChatSource[];
  sqlCalls?: ChatSqlCall[];
  generator?: string;
  createdAt?: string;
  patternHandlers?: PatternHandler[];
  className?: string;
}

function SqlCallPanel({ call }: { call: ChatSqlCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const rowLabel = call.rowCount === 1 ? "row" : "rows";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-emerald-500/10"
        data-testid="chat-sql-call-toggle"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <IconDatabase className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate font-medium text-foreground">
            {call.connectionName || "Database query"}
          </span>
          <span className="shrink-0">
            · {call.rowCount} {rowLabel}
            {call.truncated ? " (truncated)" : ""} · {call.durationMs}ms
          </span>
        </span>
        <IconChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
      <CollapsibleContent>
        <pre className="mt-2 overflow-x-auto rounded-2xl border bg-muted/60 p-3 text-xs leading-5">
          <code>{call.sql}</code>
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ChatMessage({
  content,
  role,
  sources = [],
  sqlCalls = [],
  generator,
  createdAt,
  patternHandlers = [],
  className,
}: ChatMessageProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isAssistant = role === "assistant";
  const isUser = role === "user";

  const { reasoning, displayContent } = useMemo(() => {
    const THINK_TAG_REGEX = /<think>([\s\S]*?)<\/think>/i;
    const match = THINK_TAG_REGEX.exec(content);

    if (!match) {
      return { reasoning: null, displayContent: content };
    }

    return {
      reasoning: match[1].trim(),
      displayContent: content.replace(THINK_TAG_REGEX, "").trim(),
    };
  }, [content]);

  const processContent = useCallback(
    (text: string): React.ReactNode => {
      if (!text || patternHandlers.length === 0) return text;

      const segments: React.ReactNode[] = [];
      let cursor = 0;

      while (cursor < text.length) {
        let earliest: {
          handler: PatternHandler;
          match: RegExpExecArray;
          index: number;
        } | null = null;

        for (const handler of patternHandlers) {
          handler.pattern.lastIndex = cursor;
          const match = handler.pattern.exec(text);
          if (match && (!earliest || match.index < earliest.index)) {
            earliest = { handler, match, index: match.index };
          }
        }

        if (!earliest) {
          segments.push(text.slice(cursor));
          break;
        }

        if (earliest.index > cursor) {
          segments.push(text.slice(cursor, earliest.index));
        }

        segments.push(
          <span key={`pattern-${cursor}`}>
            {earliest.handler.render(earliest.match)}
          </span>,
        );

        cursor = earliest.index + earliest.match[0].length;
      }

      return segments;
    },
    [patternHandlers],
  );

  const isDegraded =
    typeof generator === "string" && generator.startsWith("fallback-");
  const showDegradedBadge = import.meta.env.DEV && role === "assistant" && isDegraded;

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}>
      <div className={cn("flex w-full flex-col gap-3", isAssistant ? "max-w-3xl" : "max-w-[min(85%,42rem)] items-end")}>
        <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", isUser && "justify-end")}>
          <div className="font-medium text-foreground/80">{isUser ? "You" : role === "assistant" ? "Assistant" : "System"}</div>
          {showDegradedBadge && (
            <span
              className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400"
              title={`Generator: ${generator ?? "unknown"}. Visible in dev only.`}
            >
              degraded mode
            </span>
          )}
        </div>
        {createdAt && (
          <div className="text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleTimeString()}
          </div>
        )}

        <div
          className={cn(
            "flex flex-col gap-3",
            isAssistant && "rounded-3xl px-1 py-1",
            isUser && "rounded-[1.6rem] bg-primary px-4 py-3 text-primary-foreground shadow-sm",
            role === "system" && "rounded-2xl border bg-muted/40 px-4 py-3",
          )}
        >
          {reasoning && (
            <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
              <button
                type="button"
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <IconBrain className="h-3.5 w-3.5 text-purple-500" />
                <span>Model reasoning</span>
                <IconChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showReasoning && "rotate-180",
                  )}
                />
              </button>
              <CollapsibleContent>
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3 text-sm text-muted-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {isAssistant ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-7 prose-headings:mb-3 prose-headings:mt-8 prose-headings:font-semibold prose-p:my-3 prose-li:my-1 prose-ul:my-4 prose-ol:my-4 prose-table:text-sm prose-th:border prose-th:border-border prose-td:border prose-td:border-border prose-pre:rounded-2xl prose-pre:border prose-pre:bg-muted/60 prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none md:prose-base">
              {patternHandlers.length > 0 ? (
                processContent(displayContent)
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
              )}
            </div>
          ) : (
            <div className={cn("whitespace-pre-wrap text-sm leading-6", isUser && "text-primary-foreground")}>{displayContent}</div>
          )}

          {isAssistant && sqlCalls.length > 0 && (
            <div className="flex flex-col gap-2" data-testid="chat-sql-calls">
              {sqlCalls.map((call, index) => (
                <SqlCallPanel
                  key={`sql-${index}-${call.connectionId}-${call.durationMs}`}
                  call={call}
                />
              ))}
            </div>
          )}

          {sources.length > 0 && (
            <>
              <Separator className="my-1" />
              <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Sources</div>
                <div className="flex flex-wrap gap-2">
                  {sources.map((source, index) => {
                    const isSafeUrl = /^https?:\/\//i.test(source.webUrl);

                    return isSafeUrl ? (
                      <a
                        key={`source-${index}-${source.webUrl}`}
                        href={source.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-full border px-2.5 py-1 underline-offset-4 hover:bg-accent/60 hover:underline"
                      >
                        {source.name} · {source.sourceName}
                      </a>
                    ) : (
                      <span key={`source-${index}-${source.webUrl}`} className="inline-flex rounded-full border px-2.5 py-1">
                        {source.name} · {source.sourceName}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
