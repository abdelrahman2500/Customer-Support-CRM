import { apiFetch } from "./api";

/**
 * Story 31 — SLA Policy Management. A dedicated API client file (plan
 * Design item 4): SLA policies are a distinct domain from tickets/customers/
 * users, with no existing precedent forcing them into `tickets-api.ts`, so
 * this file deliberately does not import from or re-export anything there.
 *
 * `SlaPolicyPriority` mirrors the backend's `TicketPriority` Prisma enum
 * (`apps/api/src/modules/sla-policies/dto/create-sla-policy.dto.ts`) by value,
 * not by import — this file has no dependency on `@prisma/client` or on
 * `tickets-api.ts`'s own `TicketPriority`.
 */
export type SlaPolicyPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/**
 * Mirrors the backend's own `SlaPolicySummary`
 * (`apps/api/src/modules/sla-policies/sla-policies.service.ts`) exactly —
 * confirmed against that file during implementation. It does not include
 * `branchId`/`createdAt`/`updatedAt`: the real service never returns them
 * (tenant scoping is enforced server-side and never needs to round-trip to
 * the client; no consumer needs creation/update timestamps).
 */
export interface SlaPolicySummary {
  id: string;
  departmentId: string | null;
  category: string | null;
  priority: SlaPolicyPriority | null;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isActive: boolean;
}

/** Mirrors the existing `CreateSlaPolicyDto` exactly (`apps/api/src/modules/sla-policies/dto/create-sla-policy.dto.ts`). */
export interface CreateSlaPolicyInput {
  departmentId?: string;
  category?: string;
  priority?: SlaPolicyPriority;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
}

/**
 * Mirrors the existing `UpdateSlaPolicyDto` exactly
 * (`apps/api/src/modules/sla-policies/dto/update-sla-policy.dto.ts`). Plan
 * Design item 2: only `responseTargetMinutes`/`resolutionTargetMinutes`/
 * `isActive` are ever sent by this story's UI — `departmentId`/`category`/
 * `priority` exist on the DTO but are deliberately never edited after
 * creation (changing scoping fields would change which tickets a policy
 * applies to).
 */
export interface UpdateSlaPolicyInput {
  departmentId?: string;
  category?: string;
  priority?: SlaPolicyPriority;
  responseTargetMinutes?: number;
  resolutionTargetMinutes?: number;
  isActive?: boolean;
}

export function listSlaPolicies(): Promise<SlaPolicySummary[]> {
  return apiFetch<SlaPolicySummary[]>("/sla-policies");
}

export function getSlaPolicy(id: string): Promise<SlaPolicySummary> {
  return apiFetch<SlaPolicySummary>(`/sla-policies/${id}`);
}

export function createSlaPolicy(input: CreateSlaPolicyInput): Promise<SlaPolicySummary> {
  return apiFetch<SlaPolicySummary>("/sla-policies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSlaPolicy(id: string, input: UpdateSlaPolicyInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/sla-policies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
