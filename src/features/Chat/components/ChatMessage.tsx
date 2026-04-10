import { useState, useMemo, useCallback } from "react";
import { cn } from "@/shared/lib/utils";
import ReactMarkdown from "react-markdown";
import { Collapsible, CollapsibleContent } from "@/shared/components/ui/collapsible";
import { IconChevronDown, IconBrain } from "@tabler/icons-react";
import { Separator } from "@/shared/components/ui/separator";
import type { ChatSource } from "../types";

export interface PatternHandler {
  pattern: RegExp;
  render: (match: RegExpExecArray) => React.ReactNode;
}

export interface ChatMessageProps {
  content: string;
  role: "user" | "assistant" | "system";
  sources?: ChatSource[];
  generator?: string;
  createdAt?: string;
  patternHandlers?: PatternHandler[];
  className?: string;
}

export function ChatMessage({
  content,
  role,
  sources = [],
  generator,
  createdAt,
  patternHandlers = [],
  className,
}: ChatMessageProps) {
  const [showReasoning, setShowReasoning] = useState(false);

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
    <div
      className={cn(
        "rounded-lg border p-4",
        role === "user" ? "bg-muted/40" : "bg-background",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="font-medium capitalize">{role}</div>
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
      </div>

      {reasoning && (
        <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
            <div className="mb-3 rounded-md border border-purple-500/20 bg-purple-500/5 p-3 text-sm text-muted-foreground">
              <ReactMarkdown>{reasoning}</ReactMarkdown>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {role === "assistant" ? (
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-6">
          {patternHandlers.length > 0 ? (
            processContent(displayContent)
          ) : (
            <ReactMarkdown>{displayContent}</ReactMarkdown>
          )}
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-6">
          {displayContent}
        </div>
      )}

      {sources.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Sources</div>
            {sources.map((source, index) => {
              const isSafeUrl = /^https?:\/\//i.test(source.webUrl);
              return isSafeUrl ? (
                <a
                  key={`source-${index}-${source.webUrl}`}
                  href={source.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block underline-offset-4 hover:underline"
                >
                  {source.name} · {source.sourceName}
                </a>
              ) : (
                <span key={`source-${index}-${source.webUrl}`} className="block">
                  {source.name} · {source.sourceName}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
