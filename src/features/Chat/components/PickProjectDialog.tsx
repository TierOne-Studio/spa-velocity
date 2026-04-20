import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { useProjects } from "@/features/Projects/hooks/useProjects";

type PickProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  onSelect: (projectId: string) => void;
  currentProjectId?: string | null;
};

export function PickProjectDialog({
  open,
  onOpenChange,
  organizationId,
  onSelect,
  currentProjectId,
}: PickProjectDialogProps) {
  const { data: projects = [], isLoading, error } = useProjects({
    organizationId,
    enabled: open && !!organizationId,
  });

  const isSwitchMode = currentProjectId !== undefined && currentProjectId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="pick-project-dialog">
        <DialogHeader>
          <DialogTitle>{isSwitchMode ? "Switch project" : "Pick a project"}</DialogTitle>
          <DialogDescription>
            {isSwitchMode
              ? "Picking a different project starts a new chat under that project."
              : "Chats belong to a project. Pick one — or create a project first."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2" data-testid="pick-project-list">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : projects.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No projects yet.
            </div>
          ) : (
            <ul className="space-y-1 max-h-72 overflow-y-auto">
              {projects.map((project) => {
                const isCurrent = project.id === currentProjectId;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(project.id)}
                      disabled={isCurrent}
                      className="w-full rounded-md border p-3 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                      data-testid={`pick-project-option-${project.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{project.name}</span>
                        {isCurrent && (
                          <Badge variant="secondary" data-testid={`pick-project-current-${project.id}`}>
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {project.sourceCount} source{project.sourceCount === 1 ? "" : "s"} ·{" "}
                        {project.conversationCount} chat{project.conversationCount === 1 ? "" : "s"}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button asChild variant="outline" onClick={() => onOpenChange(false)}>
            <Link to="/projects">Manage projects</Link>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
