"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateNotificationTemplateMutation,
  useNotificationTemplatesQuery,
} from "@/hooks/use-notification-templates";
import { ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** The same three event types `NOTIFICATION_EVENT_TYPES` names on the
 * backend — mirrors `EVENT_LABEL_KEYS` in `notification-history-view.tsx`/
 * `notification-preferences-section.tsx` exactly. */
const EVENT_TYPES = ["sla.at_risk", "sla.breached", "ticket.escalated"] as const;
const EVENT_LABEL_KEYS: Record<string, string> = {
  "sla.at_risk": "eventLabel.slaAtRisk",
  "sla.breached": "eventLabel.slaBreached",
  "ticket.escalated": "eventLabel.ticketEscalated",
};

/**
 * Story 61 — one fixed row per event type (mirrors
 * `NotificationPreferencesSection`'s "fixed enumeration" shape, not
 * `AutomationRulesView`'s arbitrary-list shape — there are exactly three
 * possible templates, never more). The backend's `POST` is upsert
 * (`@@unique([branchId, eventType])`), so this view never needs a separate
 * create-vs-update path — every save is the same call, pre-filled with the
 * existing text when one exists.
 */
export function NotificationTemplatesView() {
  const t = useTranslations("notificationTemplates");
  const templatesQuery = useNotificationTemplatesQuery();

  const templateByEventType = useMemo(() => {
    const map = new Map<string, string>();
    for (const template of templatesQuery.data ?? []) {
      map.set(template.eventType, template.template);
    }
    return map;
  }, [templatesQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-slate-500">{t("description")}</p>

      {templatesQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-24 w-full" />
          ))}
        </div>
      )}

      {templatesQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => templatesQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {templatesQuery.isSuccess && (
        <div className="flex flex-col gap-4">
          {EVENT_TYPES.map((eventType) => (
            <TemplateForm
              key={eventType}
              eventType={eventType}
              existingTemplate={templateByEventType.get(eventType) ?? ""}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TemplateForm({
  eventType,
  existingTemplate,
}: {
  eventType: string;
  existingTemplate: string;
}) {
  const t = useTranslations("notificationTemplates");
  const mutation = useCreateNotificationTemplateMutation();
  const [text, setText] = useState(existingTemplate);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ eventType, template: text });
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("saveFailed"));
    }
  }

  const labelKey = EVENT_LABEL_KEYS[eventType];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{labelKey ? t(labelKey) : eventType}</h2>
      <form className="mt-2 flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("templateLabel")}
          <textarea
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-ink-subtle focus-ring"
            rows={2}
            value={text}
            placeholder={t("templatePlaceholder")}
            onChange={(inputEvent) => setText(inputEvent.target.value)}
          />
        </label>
        <p className="text-xs text-ink-subtle">{t("placeholderHint")}</p>
        <div>
          <Button type="submit" size="sm" disabled={mutation.isPending || !text.trim()}>
            {mutation.isPending ? t("saving") : t("save")}
          </Button>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
      </form>
    </div>
  );
}
