import { IconBrain, IconWorldSearch, IconMessage } from "@tabler/icons-react";
import { cn } from "@/shared/lib/utils";
import { useState, useEffect } from "react";

export type GenerationStage = "thinking" | "searching" | "responding" | "idle";

interface GenerationStatusProps {
  stage: GenerationStage;
  searchQuery?: string;
  className?: string;
}

export function GenerationStatus({ stage, searchQuery, className }: GenerationStatusProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (stage === "idle") return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [stage]);

  if (stage === "idle") return null;

  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground">
        {stage === "thinking" && (
          <>
            <IconBrain className="h-4 w-4 text-purple-500 animate-pulse" />
            <span>Thinking{dots}</span>
          </>
        )}

        {stage === "searching" && (
          <>
            <IconWorldSearch className="h-4 w-4 text-blue-500 animate-spin" />
            <span className="truncate">
              {searchQuery ? `Searching: ${searchQuery}${dots}` : `Searching${dots}`}
            </span>
          </>
        )}

        {stage === "responding" && (
          <>
            <IconMessage className="h-4 w-4 text-green-500 animate-pulse" />
            <span>Responding{dots}</span>
          </>
        )}
      </div>
    </div>
  );
}
