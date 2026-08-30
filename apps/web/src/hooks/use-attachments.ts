import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAttachments, uploadAttachment } from "@/lib/attachments-api";
import type { AttachmentOwner } from "@/lib/attachments-api";

/**
 * Story 66 — dedicated Ticket Attachments hooks, mirroring
 * `use-knowledge-base.ts`'s never-optimistic convention exactly but living
 * in their own file — no import from `use-tickets.ts`.
 *
 * Story 67 — generalized to an `AttachmentOwner` parameter, mirroring
 * `attachments-api.ts`'s own generalization — one hook pair serves both
 * `TicketDetailView` and `CustomerDetailView`.
 */
export const attachmentsQueryKey = (owner: AttachmentOwner) =>
  ["attachments", owner.type, owner.id] as const;

export function useAttachmentsQuery(owner: AttachmentOwner) {
  return useQuery({
    queryKey: attachmentsQueryKey(owner),
    queryFn: () => listAttachments(owner),
  });
}

/**
 * Never applies optimistically (same rule every other mutation hook in this
 * codebase follows): only a successful upload invalidates the list, forcing
 * it to re-fetch the real, authoritative state.
 */
export function useUploadAttachmentMutation(owner: AttachmentOwner) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(owner, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attachmentsQueryKey(owner) });
    },
  });
}
