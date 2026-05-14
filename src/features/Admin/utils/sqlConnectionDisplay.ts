export interface SqlConnectionDisplayParts {
  username: string;
  host: string;
  port: number | string;
  database: string;
}

function truncateSegment(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const headLength = Math.max(4, Math.ceil((maxLength - 1) / 2));
  const tailLength = Math.max(3, maxLength - headLength - 1);
  return `${trimmed.slice(0, headLength)}…${trimmed.slice(-tailLength)}`;
}

export function formatSqlConnectionDisplay(parts: SqlConnectionDisplayParts): string {
  return `${truncateSegment(parts.username, 18)}@${truncateSegment(parts.host, 28)}:${parts.port}/${truncateSegment(parts.database, 18)}`;
}

export function formatSqlConnectionDisplayFull(parts: SqlConnectionDisplayParts): string {
  return `${parts.username}@${parts.host}:${parts.port}/${parts.database}`;
}
