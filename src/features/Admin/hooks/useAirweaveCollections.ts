import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/shared/lib/fetch-with-auth";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import type { AirweaveCollection } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type CollectionQueryScope = {
  activeOrganizationId?: string | null;
  userId?: string | null;
};

type ApiResponse<T> = {
  data: T;
};

export const airweaveCollectionKeys = {
  all: ["admin", "airweave-collections"] as const,
  lists: (search: string | null | undefined, scope?: CollectionQueryScope) =>
    [
      ...airweaveCollectionKeys.all,
      scope?.userId ?? "anonymous",
      scope?.activeOrganizationId ?? "no-org",
      search ?? "",
    ] as const,
};

function useCollectionQueryScope(): CollectionQueryScope {
  const { data: session } = useEffectiveSession();

  return {
    userId: session?.user?.id ?? null,
    activeOrganizationId:
      (session?.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ?? null,
  };
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || fallbackMessage);
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

async function getAvailableCollections(search?: string): Promise<AirweaveCollection[]> {
  const url = new URL(`${API_BASE_URL}/api/airweave/collections`);
  if (search?.trim()) {
    url.searchParams.set("search", search.trim());
  }

  const response = await fetchWithAuth(url.toString());
  return parseApiResponse<AirweaveCollection[]>(response, "Failed to fetch Airweave collections");
}

export function useAirweaveCollections(options?: { search?: string; enabled?: boolean }) {
  const scope = useCollectionQueryScope();

  return useQuery({
    queryKey: airweaveCollectionKeys.lists(options?.search, scope),
    queryFn: () => getAvailableCollections(options?.search),
    enabled: options?.enabled ?? true,
  });
}