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
  category: string | null;
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

export interface CustomerSummary {
  id: string;
  displayName: string;
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
}

export interface ListTicketsFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  assignedToUserId?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
}

function toQueryString(filters: ListTicketsFilters): string {
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

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  assignedToUserId?: string;
}

export function updateTicket(id: string, input: UpdateTicketInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listCustomers(): Promise<CustomerSummary[]> {
  return apiFetch<CustomerSummary[]>("/customers");
}

export function listUsers(): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>("/identity/users");
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
 * `contactId`/`departmentId`/`assignedToUserId` are deliberately not part of
 * this input type — plan Design item 3: contact creation, department, and
 * assignment-at-creation-time are all explicitly out of scope for this
 * story's minimum form.
 */
export interface CreateTicketInput {
  customerId: string;
  subject: string;
  category?: string;
  priority?: TicketPriority;
}

export function createTicket(input: CreateTicketInput): Promise<TicketSummary> {
  return apiFetch<TicketSummary>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
