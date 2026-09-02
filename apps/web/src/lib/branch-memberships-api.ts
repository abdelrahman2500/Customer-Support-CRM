import { apiFetch } from "./api";

/**
 * Story 118 — a dedicated API client file, mirroring `reporting-api.ts`'s
 * own "distinct domain, own file" convention. Mirrors the backend's own
 * `BranchMembershipSummary`
 * (`apps/api/src/modules/identity/identity.service.ts`) exactly.
 */
export interface BranchMembershipSummary {
  branchId: string;
  branchName: string;
  departmentId: string | null;
  departmentName: string | null;
  roleId: string;
  roleName: string;
  isActive: boolean;
}

export function listMyBranchMemberships(): Promise<BranchMembershipSummary[]> {
  return apiFetch<BranchMembershipSummary[]>("/auth/me/branches");
}
