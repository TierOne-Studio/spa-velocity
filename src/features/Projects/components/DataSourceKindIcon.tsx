import { IconDatabase, IconLink, IconBooks } from "@tabler/icons-react";
import type { DataSourceKind } from "../types";

type Props = {
  kind: DataSourceKind;
  className?: string;
};

export function DataSourceKindIcon({ kind, className }: Props) {
  if (kind === "database") return <IconDatabase className={className} />;
  if (kind === "external") return <IconLink className={className} />;
  return <IconBooks className={className} />;
}

export function dataSourceKindLabel(kind: DataSourceKind): string {
  if (kind === "database") return "Database";
  if (kind === "external") return "External source";
  return "Airweave collection";
}
