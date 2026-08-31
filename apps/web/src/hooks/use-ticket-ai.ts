import { useMutation, useQuery } from "@tanstack/react-query";
import { getAiResult, submitAiOperation } from "@/lib/ticket-ai-api";
import type { TicketAiFeature } from "@/lib/ticket-ai-api";

/**
 * Story 79 — mirrors `use-ticket-messages.ts`'s shape. A distinct query
 * key per `logId` (not a shared per-ticket key): two operations submitted
 * back-to-back for the same ticket each get their own `AiPromptLog.id`
 * and therefore their own cache entry — no collision, no risk of one
 * operation's refetch clobbering another's in-flight result.
 */
export const ticketAiResultQueryKey = (ticketId: string, logId: string) =>
  ["ticket", ticketId, "ai", logId] as const;

/** Disabled until a `logId` exists (i.e. before any operation has been
 * submitted for this card instance) — mirrors `useTicketAiResultQuery`'s
 * only caller, `TicketAiCard`, never rendering this query with a `null`
 * `logId` it would actually fetch. */
export function useTicketAiResultQuery(ticketId: string, logId: string | null) {
  return useQuery({
    queryKey: ticketAiResultQueryKey(ticketId, logId ?? ""),
    queryFn: () => getAiResult(ticketId, logId as string),
    enabled: logId !== null,
  });
}

export function useSubmitAiOperationMutation(ticketId: string) {
  return useMutation({
    mutationFn: (feature: TicketAiFeature) => submitAiOperation(ticketId, feature),
  });
}
