"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateNotificationTemplateMutation,
  useNotificationTemplatesQuery,
} from "@/hooks/use-notification-templates";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@crm/ui";

/** RM-30 — the same sentinel-for-"no locale" convention
 * `AutomationRulesView`'s `UNSET_PRIORITY`/`CreateTicketView`'s
 * `UNSET_CATEGORY` already established: `""` stands in for the `null`
 * ("shown to every viewer") row, since a `Select` cannot hand back a
 * literal `null` value. */
const UNSET_LOCALE = "";

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
 * possible templates, never more). The backend's `POST` is create-or-update
 * (keyed on `(branchId, eventType, locale)`), so this view never needs a
 * separate create-vs-update path — every save is the same call, pre-filled
 * with the existing text for whichever locale is currently selected.
 *
 * RM-30 — each event type's card gains a locale picker ("All locales
 * (default)"/"English"/"Arabic") that selects which row's text the
 * textarea currently shows/saves — an admin authors the branch's default
 * template as before, and can additionally layer a locale-specific
 * override on top without disturbing it.
 */
export function NotificationTemplatesView() {
  const t = useTranslations("notificationTemplates");
  const templatesQuery = useNotificationTemplatesQuery();

  // RM-30 — keyed by `eventType:locale` (`UNSET_LOCALE` standing in for
  // the default, `locale: null` row), mirroring
  // `NotificationHistoryView`'s own `templateByKey` shape.
  const templateByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const template of templatesQuery.data ?? []) {
      map.set(`${template.eventType}:${template.locale ?? UNSET_LOCALE}`, template.template);
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
            <TemplateForm key={eventType} eventType={eventType} templateByKey={templateByKey} />
          ))}
        </div>
      )}
    </section>
  );
}

/** RM-30 — `locale` is local UI state, not derived from `templateByKey`:
 * switching it changes which row the textarea is currently editing (reset
 * to that row's own saved text, or blank if none exists yet), independent
 * of whatever was last typed for a different locale. */
function TemplateForm({
  eventType,
  templateByKey,
}: {
  eventType: string;
  templateByKey: Map<string, string>;
}) {
  const t = useTranslations("notificationTemplates");
  const errorMessage = useErrorMessage();
  const mutation = useCreateNotificationTemplateMutation();
  const [locale, setLocale] = useState(UNSET_LOCALE);
  const [text, setText] = useState(templateByKey.get(`${eventType}:${UNSET_LOCALE}`) ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleLocaleChange(nextLocale: string): void {
    setLocale(nextLocale);
    setText(templateByKey.get(`${eventType}:${nextLocale}`) ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        eventType,
        ...(locale !== UNSET_LOCALE ? { locale: locale as "en" | "ar" } : {}),
        template: text,
      });
    } catch (submitError) {
      setError(
        errorMessage(submitError, { forbidden: t("saveForbidden"), generic: t("saveFailed") }),
      );
    }
  }

  const labelKey = EVENT_LABEL_KEYS[eventType];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{labelKey ? t(labelKey) : eventType}</h2>
      <form className="mt-2 flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("localeLabel")}
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger className="w-48" aria-label={t("localeLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET_LOCALE}>{t("localeDefault")}</SelectItem>
              <SelectItem value="en">{t("localeEnglish")}</SelectItem>
              <SelectItem value="ar">{t("localeArabic")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
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
