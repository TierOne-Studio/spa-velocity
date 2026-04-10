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
    <div className={cn("flex justify-start", className)}>
      <div className="flex items-center gap-2 rounded-lg bg-muted p-3 max-w-[80%]">
        {stage === "thinking" && (
          <>
            <IconBrain className="h-4 w-4 text-purple-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">Thinking{dots}</span>
          </>
        )}

        {stage === "searching" && (
          <>
            <IconWorldSearch className="h-4 w-4 text-blue-500 animate-spin" />
            <span className="text-sm text-muted-foreground">
              {searchQuery ? `Searching: ${searchQuery}${dots}` : `Searching${dots}`}
            </span>
          </>
        )}

        {stage === "responding" && (
          <>
            <IconMessage className="h-4 w-4 text-green-500 animate-bounce" />
            <span className="text-sm text-muted-foreground">Responding{dots}</span>
          </>
        )}
      </div>
    </div>
  );
}
