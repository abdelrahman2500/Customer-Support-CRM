import { apiFetch } from "./api";

/**
 * Story 57 — SLA & Automation — Automation Rules Foundation. A dedicated
 * API client file, mirroring `sla-policies-api.ts`'s own "distinct domain,
 * own file, no import from `tickets-api.ts`" convention.
 *
 * Mirrors the backend's own `AutomationRuleSummary`
 * (`apps/api/src/modules/sla-policies/automation-rules.service.ts`) exactly.
 *
 * Story 120 — `conditionCategory`/`actionSetCategory` (free text) renamed
 * `conditionCategoryId`/`actionSetCategoryId`, mirroring the backend's own
 * schema change.
 *
 * RM-24 — `actionAssignmentMode`/`eligibleAgentPool` added, mirroring the
 * backend's own two new fields exactly.
 */
export const AUTOMATION_ACTION_ASSIGNMENT_MODES = ["FIXED", "LEAST_LOADED"] as const;
export type AutomationActionAssignmentMode = (typeof AUTOMATION_ACTION_ASSIGNMENT_MODES)[number];

export interface AutomationRuleSummary {
  id: string;
  name: string;
  isActive: boolean;
  conditionCategoryId: string | null;
  actionAssignToUserId: string;
  actionSetCategoryId: string | null;
  actionSetDepartmentId: string | null;
  actionAssignmentMode: AutomationActionAssignmentMode;
  eligibleAgentPool: string[];
}

/** Mirrors the existing `CreateAutomationRuleDto` exactly. */
export interface CreateAutomationRuleInput {
  name: string;
  conditionCategoryId?: string;
  actionAssignToUserId: string;
  actionSetCategoryId?: string;
  actionSetDepartmentId?: string;
  actionAssignmentMode?: AutomationActionAssignmentMode;
  eligibleAgentPool?: string[];
}

/** Mirrors the existing `UpdateAutomationRuleDto` exactly. */
export interface UpdateAutomationRuleInput {
  name?: string;
  conditionCategoryId?: string;
  actionAssignToUserId?: string;
  isActive?: boolean;
  actionSetCategoryId?: string;
  actionSetDepartmentId?: string;
  actionAssignmentMode?: AutomationActionAssignmentMode;
  eligibleAgentPool?: string[];
}

export function listAutomationRules(): Promise<AutomationRuleSummary[]> {
  return apiFetch<AutomationRuleSummary[]>("/automation-rules");
}

export function createAutomationRule(
  input: CreateAutomationRuleInput,
): Promise<AutomationRuleSummary> {
  return apiFetch<AutomationRuleSummary>("/automation-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAutomationRule(
  id: string,
  input: UpdateAutomationRuleInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/automation-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
