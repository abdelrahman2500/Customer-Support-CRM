import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookDeliveryAttempts,
  listWebhookSubscriptions,
  updateWebhookSubscription,
} from "@/lib/webhook-subscriptions-api";
import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
} from "@/lib/webhook-subscriptions-api";

/** RM-20 — dedicated webhook-subscriptions hooks, mirroring
 * `use-automation-rules.ts`'s never-optimistic convention exactly. */
export const webhookSubscriptionsQueryKey = ["webhook-subscriptions"] as const;

export function useWebhookSubscriptionsQuery() {
  return useQuery({ queryKey: webhookSubscriptionsQueryKey, queryFn: listWebhookSubscriptions });
}

export function useCreateWebhookSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWebhookSubscriptionInput) => createWebhookSubscription(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookSubscriptionsQueryKey });
    },
  });
}

export function useUpdateWebhookSubscriptionMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWebhookSubscriptionInput) => updateWebhookSubscription(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookSubscriptionsQueryKey });
    },
  });
}

export function useDeleteWebhookSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWebhookSubscription(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookSubscriptionsQueryKey });
    },
  });
}

/** Only fetched once a row's delivery log is expanded (`enabled`) —
 * mirrors `useTicketAiResultQuery`'s own "don't fetch until the caller
 * actually wants this" gating convention. */
export function useWebhookDeliveryAttemptsQuery(id: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...webhookSubscriptionsQueryKey, id, "delivery-attempts", page] as const,
    queryFn: () => listWebhookDeliveryAttempts(id, page),
    enabled,
  });
}
