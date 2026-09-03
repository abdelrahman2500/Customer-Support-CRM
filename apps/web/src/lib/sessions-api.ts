import { apiFetch } from "./api";

/**
 * Story 124 — Session/Device Management. A dedicated API client file,
 * mirroring `branch-memberships-api.ts`'s own "distinct domain, own file"
 * convention. Mirrors the backend's own `SessionSummary`
 * (`apps/api/src/modules/identity/identity.service.ts`) exactly.
 */
export interface SessionSummary {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  sessionCreatedAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export function listMySessions(): Promise<SessionSummary[]> {
  return apiFetch<SessionSummary[]>("/auth/sessions");
}

export function revokeSession(sessionId: string): Promise<void> {
  return apiFetch<void>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
}
