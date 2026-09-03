import { apiFetch, ApiError } from "./api";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TicketSlaTarget {
  id: string;
  slaPolicyId: string;
  responseTargetAt: string;
  resolutionTargetAt: string;
}

/** Mirrors `apps/api/src/modules/tickets/tickets.service.ts`'s `TicketSummary`. */
export interface TicketSummary {
  id: string;
  subject: string;
  categoryId: string | null;
  categoryName: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: string;
  contactId: string | null;
  departmentId: string | null;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `TicketListItem` — the Story 23 list-response shape (adds `slaTarget`). */
export interface TicketListItem extends TicketSummary {
  slaTarget: TicketSlaTarget | null;
}

export interface TicketHistoryEntry {
  id: string;
  eventType: string;
  actorUserId: string | null;
  snapshot: unknown;
  createdAt: string;
}

/** Story 49 — mirrors the backend's `SlaEscalationSummary` exactly
 * (`apps/api/src/modules/sla-policies/sla-escalations.service.ts`). */
export interface TicketEscalation {
  id: string;
  ticketId: string;
  branchId: string;
  targetType: string;
  targetAt: string;
  escalatedAt: string;
}

/** Story 50 — mirrors the backend's `TicketNoteSummary` exactly
 * (`apps/api/src/modules/tickets/tickets.service.ts`). */
export interface TicketNoteSummary {
  id: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
}

/** Story 55 — mirrors the backend's `TicketCsatSummary` exactly
 * (`apps/api/src/modules/tickets/tickets.service.ts`). */
export interface TicketCsat {
  id: string;
  ticketId: string;
  submittedByContactId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CustomerSummary {
  id: string;
  displayName: string;
  isActive: boolean;
  /** Story 101 — mirrors `TicketListItem.createdAt`'s own shape. */
  createdAt: string;
}

/** Story 101 — mirrors `ListTicketsFilters`'s own shape/`toQueryString`
 * convention exactly (`search`/`isActive` matches `ListCustomersQueryDto`
 * on the backend). */
export interface ListCustomersFilters {
  search?: string;
  isActive?: "true" | "false";
  sortBy?: "displayName" | "createdAt";
  sortDir?: "asc" | "desc";
}

/** Mirrors `apps/api/src/modules/customers/customers.service.ts`'s `ContactSummary`. */
export interface ContactSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  /** Story 100 — whether this contact currently has a portal password set. */
  hasPortalAccess: boolean;
}

/** Mirrors `GET /customers/:id`'s response shape — contacts already embedded, no second request needed (plan Design item 1). */
export interface CustomerDetail extends CustomerSummary {
  contacts: ContactSummary[];
}

/** Story 32 — widened additively with `isActive`/`roles` (already returned
 * by `GET /identity/users`; every existing consumer only destructures
 * `id`/`fullName` and is unaffected).
 *
 * Story 47 — further widened additively with `roleId`/`departmentId`,
 * both derived server-side from the user's `branchRoles[0]` (the same
 * "active" membership `login`/`refresh`/`getAuthenticatedUser` already key
 * off of) — needed so an edit control can know what to pre-select. */
/** Story 122 — `isLocked`/`lockedUntil` mirror the backend's own
 * server-computed lock state (`IdentityService.listUsers`) exactly —
 * never recomputed on this side from a raw timestamp against this
 * browser's own clock. */
export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  roleId: string;
  departmentId: string | null;
  isLocked: boolean;
  lockedUntil: string | null;
}

export interface ListTicketsFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: string;
  assignedToUserId?: string;
  /** Story 70 — matches `subject`/category name, case-insensitive. Mirrors
   * `knowledge-base-api.ts`'s own `search` filter shape. */
  search?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
}

/** Story 101 — widened from `ListTicketsFilters`-only to also accept
 * `ListCustomersFilters`, so `listCustomers` can reuse it too rather than
 * duplicating this exact same loop a second time in the same file. */
function toQueryString(filters: ListTicketsFilters | ListCustomersFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listTickets(filters: ListTicketsFilters = {}): Promise<TicketListItem[]> {
  return apiFetch<TicketListItem[]>(`/tickets${toQueryString(filters)}`);
}

export function getTicket(id: string): Promise<TicketSummary> {
  return apiFetch<TicketSummary>(`/tickets/${id}`);
}

export function getTicketHistory(id: string): Promise<TicketHistoryEntry[]> {
  return apiFetch<TicketHistoryEntry[]>(`/tickets/${id}/history`);
}

/** Story 49 — `GET /tickets/:id/sla-escalations` (`sla:read`), returns `[]`
 * when the ticket has no escalations yet (not a 404) — mirrors the backend's
 * own list-read convention (never swallowed like `getTicketSlaTarget`'s 404). */
export function getTicketEscalations(id: string): Promise<TicketEscalation[]> {
  return apiFetch<TicketEscalation[]>(`/tickets/${id}/sla-escalations`);
}

/** Story 50 — `GET /tickets/:id/notes` (`ticket:read`), returns `[]` when
 * the ticket has no notes yet (not a 404) — mirrors `getTicketHistory`'s own
 * list-read convention. */
export function getTicketNotes(id: string): Promise<TicketNoteSummary[]> {
  return apiFetch<TicketNoteSummary[]>(`/tickets/${id}/notes`);
}

/** Story 50 — mirrors the existing `CreateTicketNoteDto` exactly
 * (`apps/api/src/modules/tickets/dto/create-ticket-note.dto.ts`). */
export interface CreateTicketNoteInput {
  body: string;
}

export function createTicketNote(
  id: string,
  input: CreateTicketNoteInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/tickets/${id}/notes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Story 55 — `GET /tickets/:id/csat` (`ticket:read`), read-only. `undefined`
 * (not `null`) means no feedback has been submitted yet — the backend
 * replies `204 No Content` for that case, which `apiFetch` already maps to
 * `undefined` (mirrors `apps/portal`'s own `getMyTicketCsat` exactly).
 */
export function getTicketCsat(id: string): Promise<TicketCsat | undefined> {
  return apiFetch<TicketCsat | undefined>(`/tickets/${id}/csat`);
}

/**
 * `GET /tickets/:id/sla-target` returns 404 when no `SlaTicketTarget` row
 * exists (no policy matched this ticket) — Story 23's plan treats that as
 * "no SLA target," not a page error (Design item 4 / plan's own rule). This
 * is the one place that 404 is deliberately swallowed into `null` rather
 * than surfaced as an `ApiError`.
 */
export async function getTicketSlaTarget(id: string): Promise<TicketSlaTarget | null> {
  try {
    return await apiFetch<TicketSlaTarget>(`/tickets/${id}/sla-target`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** Story 42 — `subject`/`departmentId` added, mirroring the existing
 * `UpdateTicketDto` field-for-field (both already accepted by the real
 * `PATCH /tickets/:id`, previously unconsumed by any frontend). */
export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: string;
  assignedToUserId?: string;
  subject?: string;
  departmentId?: string;
}

export function updateTicket(id: string, input: UpdateTicketInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listCustomers(filters: ListCustomersFilters = {}): Promise<CustomerSummary[]> {
  return apiFetch<CustomerSummary[]>(`/customers${toQueryString(filters)}`);
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${id}`);
}

/** Story 30 — mirrors the existing `UpdateCustomerDto` exactly (`apps/api/src/modules/customers/dto/update-customer.dto.ts`). */
export interface UpdateCustomerInput {
  displayName?: string;
  isActive?: boolean;
}

export function updateCustomer(id: string, input: UpdateCustomerInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Story 30 — mirrors the existing `CreateContactDto` exactly (`apps/api/src/modules/customers/dto/create-contact.dto.ts`). */
export interface CreateContactInput {
  fullName: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export function createContact(customerId: string, input: CreateContactInput): Promise<ContactSummary> {
  return apiFetch<ContactSummary>(`/customers/${customerId}/contacts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Story 30 — mirrors the existing `UpdateContactDto` exactly (`apps/api/src/modules/customers/dto/update-contact.dto.ts`). */
export interface UpdateContactInput {
  fullName?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export function updateContact(
  customerId: string,
  contactId: string,
  input: UpdateContactInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/customers/${customerId}/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Story 52 — mirrors the existing `ResetPasswordInput`/`resetPassword` shape
 * exactly (`apps/api/src/modules/customers/dto/set-contact-portal-password.dto.ts`). */
export interface SetContactPortalPasswordInput {
  newPassword: string;
}

export function setContactPortalPassword(
  customerId: string,
  contactId: string,
  input: SetContactPortalPasswordInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/customers/${customerId}/contacts/${contactId}/portal-password`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

/** Story 100 — the inverse of `setContactPortalPassword`; same permission
 * (`customer:update`), no request body. */
export function revokeContactPortalAccess(
  customerId: string,
  contactId: string,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/customers/${customerId}/contacts/${contactId}/portal-access/revoke`,
    { method: "PATCH" },
  );
}

export function listUsers(): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>("/identity/users");
}

/** Story 38 — mirrors `apps/api/src/modules/identity/identity.service.ts`'s
 * `BranchSummary` exactly (the caller's own branch only — see that
 * interface's own doc comment). */
export interface BranchSummary {
  id: string;
  name: string;
}

/** Story 38 — mirrors the backend's own `DepartmentSummary` exactly. */
export interface DepartmentSummary {
  id: string;
  branchId: string;
  name: string;
}

export function listBranches(): Promise<BranchSummary[]> {
  return apiFetch<BranchSummary[]>("/identity/branches");
}

export function listDepartments(): Promise<DepartmentSummary[]> {
  return apiFetch<DepartmentSummary[]>("/identity/departments");
}

/** Story 38 — mirrors the existing `CreateUserDto` exactly
 * (`apps/api/src/modules/identity/dto/create-user.dto.ts`). */
export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  branchId: string;
  departmentId?: string;
  roleId: string;
}

export function createUser(input: CreateUserInput): Promise<{ id: string; email: string }> {
  return apiFetch<{ id: string; email: string }>("/identity/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Story 32 — mirrors the existing `UpdateUserDto` exactly (`apps/api/src/modules/identity/dto/update-user.dto.ts`). No role/branch change possible through this endpoint.
 *
 * Story 48 — widened additively with `email` (the same `user:update`
 * permission now also covers correcting a user's email address; the
 * endpoint/call shape below is otherwise unchanged). */
export interface UpdateUserInput {
  fullName?: string;
  isActive?: boolean;
  email?: string;
}

export function updateUser(id: string, input: UpdateUserInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Story 48 — mirrors the existing `ResetPasswordDto` exactly
 * (`apps/api/src/modules/identity/dto/reset-password.dto.ts`). Gated by the
 * new, separately-permissioned `user:reset-password` (distinct from
 * `user:update` above) — revokes every one of the target user's existing
 * refresh tokens server-side on success. */
export interface ResetPasswordInput {
  newPassword: string;
}

export function resetPassword(id: string, input: ResetPasswordInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/users/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Story 122 — clears a locked user's failed-login counter/lock
 * immediately, without waiting for the 15-minute auto-expiry. Gated by
 * `user:update` (mirrors the backend's own permission choice — see
 * `IdentityService.unlockUser`'s doc comment). No request body. */
export function unlockUser(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/users/${id}/unlock`, { method: "POST" });
}

/** Story 47 — mirrors the existing `UpdateUserAssignmentDto` exactly
 * (`apps/api/src/modules/identity/dto/update-user-assignment.dto.ts`).
 * `departmentId: null` explicitly clears a department (branch-wide role);
 * omitting a field leaves it unchanged. No branch field — reassigning a
 * user to a different Branch is out of scope (plan Design item 2). */
export interface UpdateUserAssignmentInput {
  roleId?: string;
  departmentId?: string | null;
}

export function updateUserAssignment(
  id: string,
  input: UpdateUserAssignmentInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/users/${id}/assignment`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Story 25 — mirrors the existing `CreateCustomerDto` exactly (`apps/api/src/modules/customers/dto/create-customer.dto.ts`): `displayName` only. */
export interface CreateCustomerInput {
  displayName: string;
}

export function createCustomer(input: CreateCustomerInput): Promise<CustomerSummary> {
  return apiFetch<CustomerSummary>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Story 25 — mirrors the existing `CreateTicketDto` exactly (`apps/api/src/modules/tickets/dto/create-ticket.dto.ts`).
 *
 * Story 43 — `contactId`/`departmentId`/`assignedToUserId` added, closing
 * the last three fields `CreateTicketDto` already accepted but this input
 * type never carried (Story 25's own deferral, now picked up).
 */
export interface CreateTicketInput {
  customerId: string;
  subject: string;
  categoryId?: string;
  priority?: TicketPriority;
  contactId?: string;
  departmentId?: string;
  assignedToUserId?: string;
}

export function createTicket(input: CreateTicketInput): Promise<TicketSummary> {
  return apiFetch<TicketSummary>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
