export const AUTH_STORAGE_KEYS = [
    "bearer_token",
    "original_bearer_token",
    "impersonation_mode",
] as const;

export function clearAuthStorage(): void {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}
