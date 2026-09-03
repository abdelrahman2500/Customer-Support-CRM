import { apiFetch } from "./api";

/**
 * Story 120 — Ticketing: Managed Category Taxonomy. Mirrors
 * `branches-api.ts`'s `ManagedDepartment`/`createDepartment`/
 * `updateDepartment`/`listManagedDepartments` shape exactly: a dedicated,
 * branch-scoped CRUD surface with no delete route (see
 * `TicketCategory`'s own schema doc comment).
 */
export interface TicketCategory {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

export interface CreateTicketCategoryInput {
  name: string;
}

export interface UpdateTicketCategoryInput {
  name?: string;
  isActive?: boolean;
}

/** Every ticket category in the caller's own branch, active or not
 * (`includeInactive=true`) — mirrors `listManagedDepartments`'s exact
 * shape, for the management screen. */
export function listManagedTicketCategories(): Promise<TicketCategory[]> {
  return apiFetch<TicketCategory[]>("/ticket-categories?includeInactive=true");
}

/** Active-only, for a "pick a category" control — mirrors `listBranches`/
 * `listDepartments`'s own active-only picker convention. */
export function listTicketCategories(): Promise<TicketCategory[]> {
  return apiFetch<TicketCategory[]>("/ticket-categories");
}

export function createTicketCategory(
  input: CreateTicketCategoryInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/ticket-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTicketCategory(
  id: string,
  input: UpdateTicketCategoryInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/ticket-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
