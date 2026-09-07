"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateWebhookSubscriptionMutation,
  useDeleteWebhookSubscriptionMutation,
  useUpdateWebhookSubscriptionMutation,
  useWebhookDeliveryAttemptsQuery,
  useWebhookSubscriptionsQuery,
} from "@/hooks/use-webhook-subscriptions";
import { WEBHOOK_EVENT_TYPES } from "@/lib/webhook-subscriptions-api";
import type { WebhookSubscriptionSummary } from "@/lib/webhook-subscriptions-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * RM-20 — Webhook Subscriptions + Outbound Event Dispatch. Mirrors
 * `AutomationRulesView`'s exact "table + inline add-form below it, no
 * separate route" single-page shape — the same "smallest UI surface"
 * reasoning applies here, and a subscription's delivery log is exposed as
 * an expandable section of its own row rather than a second route, for the
 * same reason.
 */
export function WebhookSubscriptionsView() {
  const t = useTranslations("webhookSubscriptions");
  const subscriptionsQuery = useWebhookSubscriptionsQuery();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      {subscriptionsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {subscriptionsQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => subscriptionsQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {subscriptionsQuery.isSuccess && subscriptionsQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
          {t("empty")}
        </p>
      )}

      {subscriptionsQuery.isSuccess && subscriptionsQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.targetUrl")}</TableHead>
              <TableHead>{t("columns.events")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptionsQuery.data.map((subscription) => (
              <SubscriptionRows key={subscription.id} subscription={subscription} />
            ))}
          </TableBody>
        </Table>
      )}

      <AddWebhookSubscriptionForm />
    </section>
  );
}

/** One subscription's own summary row, plus (when expanded) a second row
 * holding its delivery-attempt log — a dedicated component so each
 * subscription's own mutations/query are called once per row, mirroring
 * `AutomationRuleRow`'s Rules-of-Hooks convention. */
function SubscriptionRows({ subscription }: { subscription: WebhookSubscriptionSummary }) {
  const t = useTranslations("webhookSubscriptions");
  const errorMessage = useErrorMessage();
  const updateMutation = useUpdateWebhookSubscriptionMutation(subscription.id);
  const deleteMutation = useDeleteWebhookSubscriptionMutation();
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deliveriesExpanded, setDeliveriesExpanded] = useState(false);

  function handleToggleActiveClick() {
    if (subscription.isActive) {
      setConfirmDeactivateOpen(true);
      return;
    }
    updateMutation.mutate({ isActive: true });
  }

  function confirmDeactivate() {
    updateMutation.mutate({ isActive: false }, { onSuccess: () => setConfirmDeactivateOpen(false) });
  }

  function confirmDelete() {
    deleteMutation.mutate(subscription.id, { onSuccess: () => setConfirmDeleteOpen(false) });
  }

  return (
    <>
      <TableRow>
        <TableCell className="max-w-xs truncate font-mono text-xs text-slate-800" title={subscription.targetUrl}>
          {subscription.targetUrl}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {subscription.subscribedEventTypes.map((eventType) => (
              <Badge key={eventType} variant="secondary">
                {eventType}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={subscription.isActive ? "success" : "secondary"}>
            {subscription.isActive ? t("active") : t("inactive")}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={subscription.isActive ? "destructive" : "outline"}
              size="sm"
              disabled={updateMutation.isPending}
              onClick={handleToggleActiveClick}
            >
              {subscription.isActive ? t("deactivate") : t("activate")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeliveriesExpanded((current) => !current)}>
              {deliveriesExpanded ? t("hideDeliveries") : t("viewDeliveries")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
              {t("delete")}
            </Button>
            <ConfirmDialog
              open={confirmDeactivateOpen}
              onOpenChange={setConfirmDeactivateOpen}
              title={t("deactivateConfirmTitle")}
              description={t("deactivateConfirmDescription", { targetUrl: subscription.targetUrl })}
              confirmLabel={t("deactivate")}
              onConfirm={confirmDeactivate}
              isPending={updateMutation.isPending}
            />
            <ConfirmDialog
              open={confirmDeleteOpen}
              onOpenChange={setConfirmDeleteOpen}
              title={t("deleteConfirmTitle")}
              description={t("deleteConfirmDescription", { targetUrl: subscription.targetUrl })}
              confirmLabel={t("delete")}
              onConfirm={confirmDelete}
              isPending={deleteMutation.isPending}
            />
          </div>
          {(updateMutation.isError || deleteMutation.isError) && (
            <p className="mt-1 text-xs text-red-600">
              {errorMessage(updateMutation.error ?? deleteMutation.error, {
                forbidden: t("actionForbidden"),
                generic: t("actionFailed"),
              })}
            </p>
          )}
        </TableCell>
      </TableRow>
      {deliveriesExpanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-slate-50">
            <DeliveryAttemptsLog subscriptionId={subscription.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** The delivery-attempt history for one subscription — only queried once
 * its row is expanded (`useWebhookDeliveryAttemptsQuery`'s own `enabled`
 * gate), mirroring `useTicketAiResultQuery`'s "don't fetch until wanted"
 * convention. */
function DeliveryAttemptsLog({ subscriptionId }: { subscriptionId: string }) {
  const t = useTranslations("webhookSubscriptions");
  const tCommon = useTranslations("common");
  const [page, setPage] = useState(1);
  const attemptsQuery = useWebhookDeliveryAttemptsQuery(subscriptionId, page, true);

  if (attemptsQuery.isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (attemptsQuery.isError) {
    return <p className="text-xs text-red-600">{t("deliveriesError")}</p>;
  }

  if (!attemptsQuery.data || attemptsQuery.data.items.length === 0) {
    return <p className="text-xs text-ink-subtle">{t("noDeliveries")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("deliveryColumns.eventType")}</TableHead>
            <TableHead>{t("deliveryColumns.result")}</TableHead>
            <TableHead>{t("deliveryColumns.attemptedAt")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attemptsQuery.data.items.map((attempt) => (
            <TableRow key={attempt.id}>
              <TableCell>{attempt.eventType}</TableCell>
              <TableCell>
                <Badge variant={attempt.succeeded ? "success" : "destructive"}>
                  {attempt.succeeded
                    ? t("deliverySucceeded", { status: attempt.responseStatus ?? "" })
                    : (attempt.errorMessage ?? t("deliveryFailed"))}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-500">
                {new Date(attempt.attemptedAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={attemptsQuery.data.page}
        totalPages={attemptsQuery.data.totalPages}
        onPageChange={setPage}
        disabled={attemptsQuery.isPlaceholderData}
        label={tCommon("pagination.label")}
        previousLabel={tCommon("pagination.previous")}
        nextLabel={tCommon("pagination.next")}
        indicator={tCommon("pagination.indicator", {
          page: attemptsQuery.data.page,
          totalPages: attemptsQuery.data.totalPages,
        })}
      />
    </div>
  );
}

/** The smallest UI surface for a create form — an inline form below the
 * table, mirroring `AddAutomationRuleForm`'s exact submit/error pattern.
 * `secret` is shown exactly once, in an `Alert` right below the form, the
 * instant `createSubscription` succeeds — nothing re-displays it after
 * this component's own state is cleared (a page refresh, navigating away),
 * mirroring the backend's own "never serialized back out" guarantee. */
function AddWebhookSubscriptionForm() {
  const t = useTranslations("webhookSubscriptions");
  const errorMessage = useErrorMessage();
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const mutation = useCreateWebhookSubscriptionMutation();

  function toggleEventType(eventType: string, checked: boolean) {
    setSelectedEventTypes((current) =>
      checked ? [...current, eventType] : current.filter((value) => value !== eventType),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setRevealedSecret(null);
    try {
      const created = await mutation.mutateAsync({
        targetUrl: targetUrl.trim(),
        subscribedEventTypes: selectedEventTypes,
      });
      setRevealedSecret(created.secret);
      setTargetUrl("");
      setSelectedEventTypes([]);
    } catch (submitError) {
      setError(
        errorMessage(submitError, { forbidden: t("actionForbidden"), generic: t("createFailed") }),
      );
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("createHeading")}</h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("targetUrlLabel")}
          <Input
            type="url"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder="https://example.com/webhooks/crm"
            required
            className="w-full max-w-md"
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs text-slate-600">{t("eventTypesLabel")}</legend>
          <div className="flex flex-wrap gap-3">
            {WEBHOOK_EVENT_TYPES.map((eventType) => (
              <div key={eventType} className="flex items-center gap-2">
                <Checkbox
                  id={`webhook-event-${eventType}`}
                  checked={selectedEventTypes.includes(eventType)}
                  onCheckedChange={(checked) => toggleEventType(eventType, checked === true)}
                />
                <Label htmlFor={`webhook-event-${eventType}`} className="text-xs font-normal">
                  {eventType}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !targetUrl.trim() || selectedEventTypes.length === 0}
          >
            {mutation.isPending ? t("createSubmitting") : t("createSubmit")}
          </Button>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        {revealedSecret && (
          <Alert>
            <p className="font-medium">{t("secretRevealedTitle")}</p>
            <p className="mt-1 text-xs">{t("secretRevealedDescription")}</p>
            <code className="mt-2 block break-all rounded bg-slate-100 p-2 text-xs">{revealedSecret}</code>
          </Alert>
        )}
      </form>
    </div>
  );
}
