import { apiFetch } from "./api";

/**
 * Story 61 — Notifications — Custom Message Templates. A dedicated API
 * client file, mirroring `notification-preferences-api.ts`'s own "distinct
 * domain, own file" convention.
 *
 * Mirrors the backend's own `NotificationTemplateSummary`
 * (`apps/api/src/modules/notifications/notification-templates.service.ts`)
 * exactly.
 */
export interface NotificationTemplateSummary {
  id: string;
  eventType: string;
  template: string;
}

export interface CreateNotificationTemplateInput {
  eventType: string;
  template: string;
}

export interface UpdateNotificationTemplateInput {
  template: string;
}

export function listNotificationTemplates(): Promise<NotificationTemplateSummary[]> {
  return apiFetch<NotificationTemplateSummary[]>("/notification-templates");
}

export function createNotificationTemplate(
  input: CreateNotificationTemplateInput,
): Promise<NotificationTemplateSummary> {
  return apiFetch<NotificationTemplateSummary>("/notification-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNotificationTemplate(
  id: string,
  input: UpdateNotificationTemplateInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/notification-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
