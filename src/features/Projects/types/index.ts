export type DataSourceKind =
  | "airweave_collection"
  | "database"
  | "external"
  | "vector_db";

export type DataSourceStatus = "ready" | "connecting" | "error";

export interface AirweaveCollectionSourceConfig {
  collectionReadableId: string;
  collectionName: string;
}

export interface DatabaseSourceConfig {
  connectionId: string;
  connectionName: string;
}
export interface VectorDbSourceConfig {
  vectorDbId: string;
  vectorDbName: string;
}
export type ExternalSourceConfig = Record<string, unknown>;

export type ProjectDataSource =
  | {
      id: string;
      projectId: string;
      kind: "airweave_collection";
      name: string;
      config: AirweaveCollectionSourceConfig;
      status: DataSourceStatus;
      statusDetail: string | null;
      createdAt: string;
      updatedAt: string;
    }
  | {
      id: string;
      projectId: string;
      kind: "database";
      name: string;
      config: DatabaseSourceConfig;
      status: DataSourceStatus;
      statusDetail: string | null;
      createdAt: string;
      updatedAt: string;
    }
  | {
      id: string;
      projectId: string;
      kind: "vector_db";
      name: string;
      config: VectorDbSourceConfig;
      status: DataSourceStatus;
      statusDetail: string | null;
      createdAt: string;
      updatedAt: string;
    }
  | {
      id: string;
      projectId: string;
      kind: "external";
      name: string;
      config: ExternalSourceConfig;
      status: DataSourceStatus;
      statusDetail: string | null;
      createdAt: string;
      updatedAt: string;
    };

export interface ProjectSummary {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  conversationCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  sources: ProjectDataSource[];
}

export interface CreateAirweaveSourceInput {
  kind: "airweave_collection";
  name?: string;
  config: AirweaveCollectionSourceConfig;
}

export interface CreateDatabaseSourceInput {
  kind: "database";
  name: string;
  config: DatabaseSourceConfig;
}

export interface CreateVectorDbSourceInput {
  kind: "vector_db";
  name: string;
  config: VectorDbSourceConfig;
}

export interface CreateExternalSourceInput {
  kind: "external";
  name: string;
  config: ExternalSourceConfig;
}

export type CreateDataSourceInput =
  | CreateAirweaveSourceInput
  | CreateDatabaseSourceInput
  | CreateVectorDbSourceInput
  | CreateExternalSourceInput;

export interface CreateProjectInput {
  organizationId: string;
  name: string;
  description?: string | null;
  initialSources?: CreateDataSourceInput[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}
