import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTicketKbReference,
  deleteTicketKbReference,
  getTicketKbReferences,
} from "@/lib/ticket-kb-references-api";
import type { CreateTicketKbReferenceInput } from "@/lib/ticket-kb-references-api";

/**
 * RM-05 — dedicated Ticket ↔ Knowledge Base Linkage hooks, mirroring
 * `use-attachments.ts`'s never-optimistic convention exactly but living in
 * their own file — no import from `use-tickets.ts`.
 */
export const ticketKbReferencesQueryKey = (ticketId: string) =>
  ["ticket-kb-references", ticketId] as const;

export function useTicketKbReferencesQuery(ticketId: string) {
  return useQuery({
    queryKey: ticketKbReferencesQueryKey(ticketId),
    queryFn: () => getTicketKbReferences(ticketId),
  });
}

/** Never applies optimistically: only a successful `POST
 * /tickets/:id/kb-references` invalidates this ticket's own references
 * query, forcing it to re-fetch the real, authoritative list. */
export function useCreateTicketKbReferenceMutation(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketKbReferenceInput) => createTicketKbReference(ticketId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKbReferencesQueryKey(ticketId) });
    },
  });
}

/** Same never-optimistic convention as the create mutation above. */
export function useDeleteTicketKbReferenceMutation(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) => deleteTicketKbReference(ticketId, referenceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKbReferencesQueryKey(ticketId) });
    },
  });
}
