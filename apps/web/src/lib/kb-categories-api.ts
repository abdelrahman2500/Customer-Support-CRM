import { apiFetch } from "./api";

/**
 * RM-27 — Knowledge Base Category Taxonomy. Mirrors
 * `ticket-categories-api.ts`'s `TicketCategory`/`createTicketCategory`/
 * `updateTicketCategory`/`listManagedTicketCategories` shape exactly: a
 * dedicated, branch-scoped CRUD surface with no delete route (see
 * `KnowledgeBaseCategory`'s own schema doc comment).
 */
export interface KbCategory {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

export interface CreateKbCategoryInput {
  name: string;
}

export interface UpdateKbCategoryInput {
  name?: string;
  isActive?: boolean;
}

/** Every KB category in the caller's own branch, active or not
 * (`includeInactive=true`) — mirrors `listManagedTicketCategories`'s exact
 * shape, for the management screen. */
export function listManagedKbCategories(): Promise<KbCategory[]> {
  return apiFetch<KbCategory[]>("/kb-categories?includeInactive=true");
}

/** Active-only, for a "pick a category" control — mirrors
 * `listTicketCategories`'s own active-only picker convention. */
export function listKbCategories(): Promise<KbCategory[]> {
  return apiFetch<KbCategory[]>("/kb-categories");
}

export function createKbCategory(input: CreateKbCategoryInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/kb-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateKbCategory(
  id: string,
  input: UpdateKbCategoryInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/kb-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
