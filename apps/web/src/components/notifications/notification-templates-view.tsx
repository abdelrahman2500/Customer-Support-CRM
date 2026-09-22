"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateNotificationTemplateMutation,
  useNotificationTemplatesQuery,
  useUpdateNotificationTemplateMutation,
} from "@/hooks/use-notification-templates";
import { useErrorMessage } from "@/hooks/use-error-message";
import type { NotificationTemplateSummary } from "@/lib/notification-templates-api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Alert,
  Badge,
  Button,
  Card,
  LoadingStatus,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "@crm/ui";

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
  const tCommon = useTranslations("common");
  const templatesQuery = useNotificationTemplatesQuery();

  // RM-30 — keyed by `eventType:locale` (`UNSET_LOCALE` standing in for
  // the default, `locale: null` row), mirroring
  // `NotificationHistoryView`'s own `templateByKey` shape.
  //
  // Story 130 — holds the whole row rather than just its text: the
  // lifecycle toggle needs the row's own `id` to PATCH and its `isActive`
  // to render, and both were being discarded here.
  const templateByKey = useMemo(() => {
    const map = new Map<string, NotificationTemplateSummary>();
    for (const template of templatesQuery.data ?? []) {
      map.set(`${template.eventType}:${template.locale ?? UNSET_LOCALE}`, template);
    }
    return map;
  }, [templatesQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />

      {templatesQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-24 w-full" />
          ))}
        </LoadingStatus>
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
  templateByKey: Map<string, NotificationTemplateSummary>;
}) {
  const t = useTranslations("notificationTemplates");
  const errorMessage = useErrorMessage();
  const mutation = useCreateNotificationTemplateMutation();
  const [locale, setLocale] = useState(UNSET_LOCALE);
  const [text, setText] = useState(
    templateByKey.get(`${eventType}:${UNSET_LOCALE}`)?.template ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  /** Story 130 — the saved row for whichever locale the form is currently
   * editing, or `undefined` when nothing has been authored for it yet.
   * The lifecycle toggle only exists once there is a row to retire. */
  const savedTemplate = templateByKey.get(`${eventType}:${locale}`);

  function handleLocaleChange(nextLocale: string): void {
    setLocale(nextLocale);
    setText(templateByKey.get(`${eventType}:${nextLocale}`)?.template ?? "");
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
    <Card className="p-surface">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{labelKey ? t(labelKey) : eventType}</h2>
        {savedTemplate && <TemplateLifecycleToggle template={savedTemplate} />}
      </div>
      <form className="mt-2 flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
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
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          {t("templateLabel")}
          <Textarea
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
    </Card>
  );
}

/**
 * Story 130 — the lifecycle control, mirroring `AutomationRulesView`'s own
 * toggle exactly: a state `Badge`, a `Button` whose variant and label flip
 * with that state, and a `ConfirmDialog` guarding only the destructive
 * direction (deactivating). Reactivating is a single click, since it
 * restores rather than removes.
 *
 * There is no delete: this resource has no hard `DELETE` route, by design
 * (see `NotificationTemplate`'s own schema doc comment). Deactivating is
 * how a template authored for the wrong event type or locale is retired.
 */
function TemplateLifecycleToggle({ template }: { template: NotificationTemplateSummary }) {
  const t = useTranslations("notificationTemplates");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateNotificationTemplateMutation(template.id);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  function handleToggleActiveClick(): void {
    if (template.isActive) {
      setConfirmDeactivateOpen(true);
      return;
    }
    mutation.mutate({ isActive: true });
  }

  function confirmDeactivate(): void {
    mutation.mutate({ isActive: false }, { onSuccess: () => setConfirmDeactivateOpen(false) });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Badge variant={template.isActive ? "success" : "secondary"}>
          {template.isActive ? t("active") : t("inactive")}
        </Badge>
        <Button
          variant={template.isActive ? "destructive" : "outline"}
          size="sm"
          disabled={mutation.isPending}
          onClick={handleToggleActiveClick}
        >
          {template.isActive ? t("deactivate") : t("activate")}
        </Button>
        <ConfirmDialog
          open={confirmDeactivateOpen}
          onOpenChange={setConfirmDeactivateOpen}
          title={t("deactivateConfirmTitle")}
          description={t("deactivateConfirmDescription")}
          confirmLabel={t("deactivate")}
          onConfirm={confirmDeactivate}
          isPending={mutation.isPending}
        />
      </div>
      {mutation.isError && (
        <p className="text-xs text-danger-solid">
          {errorMessage(mutation.error, {
            forbidden: t("saveForbidden"),
            generic: t("saveFailed"),
          })}
        </p>
      )}
    </div>
  );
}
