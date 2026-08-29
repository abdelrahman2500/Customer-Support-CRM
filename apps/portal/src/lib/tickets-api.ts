import { apiFetch } from "./api";

/**
 * Story 53 — Customer Portal — Submit & Track Own Tickets. Mirrors the
 * backend's `TicketSummary`/`TicketHistoryEntrySummary` exactly
 * (`apps/api/src/modules/tickets/tickets.service.ts`).
 */
export type PortalTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type PortalTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface PortalTicketSummary {
  id: string;
  subject: string;
  category: string | null;
  priority: PortalTicketPriority;
  status: PortalTicketStatus;
  customerId: string;
  contactId: string | null;
  departmentId: string | null;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalTicketHistoryEntry {
  id: string;
  eventType: string;
  actorUserId: string | null;
  snapshot: unknown;
  createdAt: string;
}

/** Mirrors the existing `PortalCreateTicketDto` exactly
 * (`apps/api/src/modules/portal/dto/portal-create-ticket.dto.ts`). */
export interface CreatePortalTicketInput {
  subject: string;
  category?: string;
}

export function listMyTickets(): Promise<PortalTicketSummary[]> {
  return apiFetch<PortalTicketSummary[]>("/portal/tickets");
}

export function getMyTicket(id: string): Promise<PortalTicketSummary> {
  return apiFetch<PortalTicketSummary>(`/portal/tickets/${id}`);
}

export function getMyTicketHistory(id: string): Promise<PortalTicketHistoryEntry[]> {
  return apiFetch<PortalTicketHistoryEntry[]>(`/portal/tickets/${id}/history`);
}

export function createMyTicket(
  input: CreatePortalTicketInput,
): Promise<PortalTicketSummary> {
  return apiFetch<PortalTicketSummary>("/portal/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
