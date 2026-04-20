import { fetchWithAuth } from "@/shared/lib/fetch-with-auth";
import type {
  CreateDataSourceInput,
  CreateProjectInput,
  ProjectDataSource,
  ProjectDetail,
  ProjectSummary,
  UpdateProjectInput,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type ApiResponse<T> = { data: T };

async function parseApiResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || fallbackMessage);
  }
  const result: ApiResponse<T> = await response.json();
  return result.data;
}

function withOrg(url: URL, organizationId?: string | null) {
  if (organizationId) url.searchParams.set("organizationId", organizationId);
  return url;
}

export const projectsService = {
  async list(organizationId?: string | null): Promise<ProjectSummary[]> {
    const url = withOrg(new URL(`${API_BASE_URL}/api/projects`), organizationId);
    const response = await fetchWithAuth(url.toString());
    return parseApiResponse<ProjectSummary[]>(response, "Failed to fetch projects");
  },

  async getById(
    id: string,
    organizationId?: string | null,
  ): Promise<ProjectDetail> {
    const url = withOrg(
      new URL(`${API_BASE_URL}/api/projects/${id}`),
      organizationId,
    );
    const response = await fetchWithAuth(url.toString());
    return parseApiResponse<ProjectDetail>(response, "Failed to fetch project");
  },

  async create(input: CreateProjectInput): Promise<ProjectDetail> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseApiResponse<ProjectDetail>(response, "Failed to create project");
  },

  async update(
    id: string,
    input: UpdateProjectInput,
    organizationId?: string | null,
  ): Promise<ProjectSummary> {
    const url = withOrg(
      new URL(`${API_BASE_URL}/api/projects/${id}`),
      organizationId,
    );
    const response = await fetchWithAuth(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseApiResponse<ProjectSummary>(response, "Failed to update project");
  },

  async remove(id: string, organizationId?: string | null): Promise<void> {
    const url = withOrg(
      new URL(`${API_BASE_URL}/api/projects/${id}`),
      organizationId,
    );
    const response = await fetchWithAuth(url.toString(), { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete project");
    }
  },

  async addSource(
    projectId: string,
    input: CreateDataSourceInput,
    organizationId?: string | null,
  ): Promise<ProjectDataSource> {
    const url = withOrg(
      new URL(`${API_BASE_URL}/api/projects/${projectId}/sources`),
      organizationId,
    );
    const response = await fetchWithAuth(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseApiResponse<ProjectDataSource>(
      response,
      "Failed to add data source",
    );
  },

  async removeSource(
    projectId: string,
    sourceId: string,
    organizationId?: string | null,
  ): Promise<void> {
    const url = withOrg(
      new URL(`${API_BASE_URL}/api/projects/${projectId}/sources/${sourceId}`),
      organizationId,
    );
    const response = await fetchWithAuth(url.toString(), { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to remove data source");
    }
  },
};
