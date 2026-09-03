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
  categoryId: string | null;
  categoryName: string | null;
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

/**
 * Mirrors the existing `PortalCreateTicketDto` exactly
 * (`apps/api/src/modules/portal/dto/portal-create-ticket.dto.ts`).
 *
 * Story 120 — `category` stays free text on the wire, deliberately unlike
 * `PortalTicketSummary.categoryId`/`categoryName` below: it is resolved
 * server-side to an existing `TicketCategory` by exact, case-insensitive
 * name (never auto-created from customer input) — see
 * `TicketsService.createTicketForContact`'s own doc comment.
 */
export interface CreatePortalTicketInput {
  subject: string;
  category?: string;
}

/**
 * Story 55 — mirrors the backend's `TicketCsatSummary` exactly
 * (`apps/api/src/modules/tickets/tickets.service.ts`).
 */
export interface PortalTicketCsat {
  id: string;
  ticketId: string;
  submittedByContactId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

/** Mirrors `SubmitCsatDto` exactly
 * (`apps/api/src/modules/portal/dto/submit-csat.dto.ts`). */
export interface SubmitCsatInput {
  rating: number;
  comment?: string;
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

/**
 * `undefined` (not `null`) means no feedback has been submitted yet — the
 * backend replies `204 No Content` for that case (never a literal JSON
 * `null` body, which every fetch client's `response.json()` would throw on)
 * and `apiFetch`'s shared `attempt()` already maps `204` to `undefined`.
 */
export function getMyTicketCsat(id: string): Promise<PortalTicketCsat | undefined> {
  return apiFetch<PortalTicketCsat | undefined>(`/portal/tickets/${id}/csat`);
}

export function submitMyTicketCsat(
  id: string,
  input: SubmitCsatInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/portal/tickets/${id}/csat`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Story 78 — Live Chat UI. Mirrors the backend's `ChannelMessageSummary`
 * exactly (`apps/api/src/modules/channels/channel-messages.service.ts`),
 * same independent-per-app re-declaration convention as every other type in
 * this file (`PortalTicketSummary`, `PortalTicketCsat`, etc.) — not a
 * `@crm/shared` type, matching this codebase's existing precedent.
 * `channelType` is typed loosely (`string`, not the backend's full 5-value
 * enum): Story 77 only ever produces `"LIVE_CHAT"`, and this UI never
 * branches on it.
 */
export interface ChannelMessageSummary {
  id: string;
  ticketId: string;
  channelType: string;
  direction: "INBOUND" | "OUTBOUND";
  senderContactId: string | null;
  senderUserId: string | null;
  body: string;
  createdAt: string;
}

/** Mirrors the existing `CreateChannelMessageDto` exactly
 * (`apps/api/src/modules/tickets/dto/create-channel-message.dto.ts`). */
export interface CreateChannelMessageInput {
  body: string;
}

/** `GET /portal/tickets/:id/messages` — returns `[]` when the ticket has no
 * messages yet (not a 404), mirroring `getMyTicketHistory`'s own list-read
 * convention. */
export function getMyTicketMessages(id: string): Promise<ChannelMessageSummary[]> {
  return apiFetch<ChannelMessageSummary[]>(`/portal/tickets/${id}/messages`);
}

/** `POST /portal/tickets/:id/messages`. */
export function sendMyTicketMessage(
  id: string,
  input: CreateChannelMessageInput,
): Promise<ChannelMessageSummary> {
  return apiFetch<ChannelMessageSummary>(`/portal/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
