import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAttachments, uploadAttachment } from "@/lib/attachments-api";

/**
 * Story 66 — dedicated Ticket Attachments hooks, mirroring
 * `use-knowledge-base.ts`'s never-optimistic convention exactly but living
 * in their own file — no import from `use-tickets.ts`.
 */
export const attachmentsQueryKey = (ticketId: string) => ["ticket-attachments", ticketId] as const;

export function useAttachmentsQuery(ticketId: string) {
  return useQuery({
    queryKey: attachmentsQueryKey(ticketId),
    queryFn: () => listAttachments(ticketId),
  });
}

/**
 * Never applies optimistically (same rule every other mutation hook in this
 * codebase follows): only a successful upload invalidates the list, forcing
 * it to re-fetch the real, authoritative state.
 */
export function useUploadAttachmentMutation(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(ticketId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attachmentsQueryKey(ticketId) });
    },
  });
}
