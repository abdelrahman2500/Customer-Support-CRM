import { apiFetch } from "./api";

/**
 * RM-05 — Ticket ↔ Knowledge Base Linkage. A dedicated API client file
 * (mirrors `attachments-api.ts`'s own precedent for a ticket sub-resource:
 * a distinct concern with no forcing reason to share a file with
 * `tickets-api.ts`).
 */

/** Mirrors the backend's own `TicketKbReferenceSummary` exactly
 * (`apps/api/src/modules/tickets/tickets.service.ts`). */
export interface TicketKbReferenceSummary {
  id: string;
  ticketId: string;
  articleId: string;
  articleTitle: string;
  referencedByUserId: string;
  createdAt: string;
}

/** `GET /tickets/:id/kb-references` (`ticket:read`), returns `[]` when the
 * ticket has no references yet (not a 404) — mirrors `getTicketNotes`'s own
 * list-read convention. */
export function getTicketKbReferences(ticketId: string): Promise<TicketKbReferenceSummary[]> {
  return apiFetch<TicketKbReferenceSummary[]>(`/tickets/${ticketId}/kb-references`);
}

/** Mirrors the existing `CreateTicketKbReferenceDto` exactly
 * (`apps/api/src/modules/tickets/dto/create-ticket-kb-reference.dto.ts`). */
export interface CreateTicketKbReferenceInput {
  articleId: string;
}

export function createTicketKbReference(
  ticketId: string,
  input: CreateTicketKbReferenceInput,
): Promise<TicketKbReferenceSummary> {
  return apiFetch<TicketKbReferenceSummary>(`/tickets/${ticketId}/kb-references`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteTicketKbReference(
  ticketId: string,
  referenceId: string,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/tickets/${ticketId}/kb-references/${referenceId}`, {
    method: "DELETE",
  });
}
