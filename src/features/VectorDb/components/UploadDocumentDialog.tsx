import { useRef, useState } from "react";
import {
  IconFile,
  IconFileTypeCsv,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeTxt,
  IconJson,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useUploadVectorDb } from "../hooks/useUploadVectorDb";
import { useVectorDbFiles } from "../hooks/useVectorDbFiles";
import { useDeleteVectorDbFile } from "../hooks/useDeleteVectorDbFile";
import type { IngestionJob, VectorDb } from "../types";

const ALLOWED_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ".txt,.md,.csv,.pdf,.json,.docx";

type Props = {
  vectordb: VectorDb;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function fileIcon(contentType: string) {
  if (contentType === "application/pdf") return <IconFileTypePdf className="h-4 w-4 shrink-0 text-red-500" />;
  if (contentType === "text/csv") return <IconFileTypeCsv className="h-4 w-4 shrink-0 text-green-600" />;
  if (contentType === "application/json") return <IconJson className="h-4 w-4 shrink-0 text-yellow-500" />;
  if (contentType.includes("wordprocessingml")) return <IconFileTypeDoc className="h-4 w-4 shrink-0 text-blue-500" />;
  if (contentType === "text/plain" || contentType === "text/markdown") return <IconFileTypeTxt className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <IconFile className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function FileRow({ job, onDelete, isDeleting }: { job: IngestionJob; onDelete: () => void; isDeleting: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
      {fileIcon(job.contentType)}
      <span className="min-w-0 flex-1 truncate font-medium" title={job.originalFilename}>{job.originalFilename}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status] ?? ""}`}>
        {job.status}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {new Date(job.createdAt).toLocaleDateString()}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`Delete ${job.originalFilename}`}
      >
        <IconTrash className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function UploadDocumentDialog({ vectordb, open, onOpenChange }: Props) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading: filesLoading } = useVectorDbFiles(open ? vectordb.id : "");
  const uploadMutation = useUploadVectorDb();
  const deleteMutation = useDeleteVectorDbFile();

  function handleClose() {
    if (uploadMutation.isPending) return;
    setValidationError(null);
    setProgress(0);
    onOpenChange(false);
  }

  async function handleFile(candidate: File | null) {
    if (!candidate) return;
    if (!ALLOWED_TYPES.has(candidate.type)) {
      setValidationError("File type not allowed. Accepted: .txt, .md, .csv, .pdf, .json, .docx");
      return;
    }
    if (candidate.size > MAX_SIZE) {
      setValidationError("File exceeds the 50 MB limit.");
      return;
    }
    setValidationError(null);
    setProgress(0);

    try {
      await uploadMutation.mutateAsync({
        vectorDbId: vectordb.id,
        file: candidate,
        onProgress: setProgress,
      });
      toast.success(`"${candidate.name}" uploaded. Ingestion queued.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(0);
    }
  }

  async function handleDelete(job: IngestionJob) {
    try {
      await deleteMutation.mutateAsync({ vectorDbId: vectordb.id, jobId: job.id });
      toast.success(`"${job.originalFilename}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const isDeletingId = deleteMutation.isPending ? (deleteMutation.variables as { jobId: string })?.jobId : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Documents — {vectordb.name}</DialogTitle>
        </DialogHeader>

        {/* File list */}
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {filesLoading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : files && files.length > 0 ? (
            files.map((job) => (
              <FileRow
                key={job.id}
                job={job}
                onDelete={() => handleDelete(job)}
                isDeleting={isDeletingId === job.id}
              />
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No documents yet. Drop a file below to get started.
            </p>
          )}
        </div>

        {/* Upload zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload file drop zone"
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFile(e.dataTransfer.files[0] ?? null); }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 transition-colors ${
            uploadMutation.isPending
              ? "pointer-events-none opacity-60"
              : isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/50"
          }`}
        >
          {uploadMutation.isPending ? (
            <div className="w-full space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-center text-xs text-muted-foreground">Uploading… {progress}%</p>
            </div>
          ) : (
            <>
              <IconUpload className="mb-1 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a file or click to browse</p>
              <p className="mt-0.5 text-xs text-muted-foreground">PDF, TXT, MD, CSV, JSON, DOCX — max 50 MB</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        {validationError && (
          <p className="text-sm text-destructive">{validationError}</p>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
