import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createNotificationTemplate,
  listNotificationTemplates,
  updateNotificationTemplate,
} from "@/lib/notification-templates-api";
import type {
  CreateNotificationTemplateInput,
  UpdateNotificationTemplateInput,
} from "@/lib/notification-templates-api";

/**
 * Story 61 — dedicated notification-templates hooks, mirroring
 * `use-notification-preferences.ts`'s own file/convention.
 */
export const notificationTemplatesQueryKey = ["notification-templates"] as const;

export function useNotificationTemplatesQuery() {
  return useQuery({
    queryKey: notificationTemplatesQueryKey,
    queryFn: listNotificationTemplates,
  });
}

export function useCreateNotificationTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNotificationTemplateInput) => createNotificationTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationTemplatesQueryKey });
    },
  });
}

export function useUpdateNotificationTemplateMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNotificationTemplateInput) => updateNotificationTemplate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationTemplatesQueryKey });
    },
  });
}
