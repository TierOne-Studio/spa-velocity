import { useQuery } from "@tanstack/react-query";

import { useSession } from "@shared/lib/auth-client";
import { fetchWithAuth } from "@shared/lib/fetch-with-auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const IMPERSONATION_MODE_STORAGE_KEY = "impersonation_mode";

type SessionPayload = {
  session?: {
    impersonatedBy?: string;
    activeOrganizationId?: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    role?: string | string[];
    image?: string | null;
    emailVerified?: boolean;
    banned?: boolean;
    banReason?: string;
    banExpires?: Date;
    approvalStatus?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
} | null;

function isUsingCustomImpersonation(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    localStorage.getItem(IMPERSONATION_MODE_STORAGE_KEY) === "custom" &&
    !!localStorage.getItem("original_bearer_token") &&
    !!localStorage.getItem("bearer_token")
  );
}

function getBearerToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("bearer_token");
}

export function useEffectiveSession() {
  const sessionResult = useSession();
  const useCustomBearerSession = isUsingCustomImpersonation();
  const bearerToken = getBearerToken();

  const bearerSessionQuery = useQuery<SessionPayload>({
    queryKey: ["auth", "effective-session", bearerToken],
    enabled: useCustomBearerSession && !!bearerToken,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/get-session`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch impersonated session");
      }
      return await response.json();
    },
  });

  const data = useCustomBearerSession
    ? (bearerSessionQuery.data ?? sessionResult.data)
    : sessionResult.data;

  const isPending = sessionResult.isPending || (useCustomBearerSession && bearerSessionQuery.isPending);

  const refetch = async () => {
    await sessionResult.refetch();
    if (useCustomBearerSession) {
      await bearerSessionQuery.refetch();
    }
  };

  return {
    data,
    isPending,
    refetch,
  };
}
