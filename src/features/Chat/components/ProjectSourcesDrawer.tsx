import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DataSourceKindIcon, dataSourceKindLabel } from "@/features/Projects/components/DataSourceKindIcon";
import { useProject } from "@/features/Projects/hooks/useProjects";

type ProjectSourcesDrawerProps = {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectSourcesDrawer({ projectId, open, onOpenChange }: ProjectSourcesDrawerProps) {
  const { data: project, isLoading, error } = useProject(projectId, { enabled: open && !!projectId });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md" data-testid="project-sources-drawer">
        <SheetHeader>
          <SheetTitle>{project?.name ?? "Project sources"}</SheetTitle>
          <SheetDescription>
            These sources back every message in this conversation.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : !project ? (
            <p className="text-sm text-muted-foreground">Project not available.</p>
          ) : project.sources.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No sources attached yet. Add one from the project detail page.
            </div>
          ) : (
            <ul className="space-y-2">
              {project.sources.map((source) => (
                <li
                  key={source.id}
                  className="rounded-md border p-3 flex items-start gap-3"
                  data-testid="project-source-item"
                >
                  <DataSourceKindIcon kind={source.kind} className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{source.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {dataSourceKindLabel(source.kind)}
                    </div>
                  </div>
                  <Badge variant={source.status === "ready" ? "secondary" : "outline"}>
                    {source.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {project && (
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/projects/${project.id}`}>Open project</Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
