import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMyTicketAttachments,
  uploadMyTicketAttachment,
} from "@/lib/attachments-api";

/**
 * Story 103 — Customer Portal: Ticket Attachment Upload. Mirrors
 * `apps/web/src/hooks/use-attachments.ts`'s never-optimistic convention
 * exactly, living in its own file (no import from `use-portal-tickets.ts`),
 * scoped by `ticketId` alone (see `attachments-api.ts`'s own doc comment
 * for why no `AttachmentOwner` parameter is needed here).
 */
export const myTicketAttachmentsQueryKey = (ticketId: string) =>
  ["portal-ticket-attachments", ticketId] as const;

export function useMyTicketAttachmentsQuery(ticketId: string) {
  return useQuery({
    queryKey: myTicketAttachmentsQueryKey(ticketId),
    queryFn: () => listMyTicketAttachments(ticketId),
  });
}

/** Never applies optimistically: only a successful upload invalidates the
 * list, forcing it to re-fetch the real, authoritative state. */
export function useUploadMyTicketAttachmentMutation(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadMyTicketAttachment(ticketId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myTicketAttachmentsQueryKey(ticketId) });
    },
  });
}
