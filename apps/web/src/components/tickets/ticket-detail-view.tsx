"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCreateTicketNoteMutation,
  useCustomersQuery,
  useDepartmentsQuery,
  useTicketCsatQuery,
  useTicketEscalationsQuery,
  useTicketHistoryQuery,
  useTicketNotesQuery,
  useTicketQuery,
  useTicketSlaTargetQuery,
  useUpdateTicketMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { AttachmentsCard } from "@/components/attachments/attachments-card";
import { TicketChatCard } from "@/components/tickets/ticket-chat-card";
import { TicketAiCard } from "@/components/tickets/ticket-ai-card";
import { useTicketRealtime } from "@/hooks/use-ticket-realtime";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { showSuccessToast } from "@/lib/toast-store";
import type { TicketPriority, TicketStatus } from "@/lib/tickets-api";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/** The only two real `targetType` values the backend ever emits (`response`/
 * `resolution` — see `SlaEscalationSummary`); an unrecognized value falls
 * back to the raw string rather than a missing-translation crash. Mirrors
 * `NotificationHistoryView`'s local `TARGET_TYPE_LABEL_KEYS` convention. */
const TARGET_TYPE_LABEL_KEYS: Record<string, string> = {
  response: "escalations.targetType.response",
  resolution: "escalations.targetType.resolution",
};

/**
 * Story 23 — Ticket Detail (plan Task 8). Reads `GET /tickets/:id`,
 * `/history`, and `/sla-target` (the last tolerating a 404 as "no SLA
 * target" — `getTicketSlaTarget`, not an error state). Actions (status,
 * priority, category, assignment) all go through the single existing
 * `PATCH /tickets/:id` — a rejected mutation renders inline (Design item 5:
 * never assumed to succeed) and never optimistically applies. Joins
 * `ticket:{id}` (Story 20) via `useTicketRealtime` — no other room.
 *
 * Story 42 — subject (now an editable heading, mirroring
 * `CustomerDetailView`'s displayName field) and department (a `Select`
 * sourced from the existing `useDepartmentsQuery()`, Story 38) both flow
 * through the same `PATCH /tickets/:id` and the same never-optimistic,
 * 403-vs-generic error convention as every other field here — no new
 * mutation hook, no new error-handling branch.
 *
 * Story 49 — a new escalations card (below the SLA card, Design item 6),
 * reading the existing `GET /tickets/:id/sla-escalations` via
 * `useTicketEscalationsQuery`, mirroring the History card's exact
 * loading/error/empty/populated JSX shape. Empty is a normal, non-error
 * state (`[]`, never a 404) — same convention as `historyQuery`.
 *
 * Story 50 — a new notes card, appended after History (Design item 7),
 * reading `GET /tickets/:id/notes` via `useTicketNotesQuery` (same
 * loading/error/empty/populated shape as History/Escalations) and an inline
 * add-note form using `useCreateTicketNoteMutation`. Author names are
 * resolved via a `userNameById` memo built from the already-fetched
 * `useUsersQuery()` data, mirroring `customerNameById`'s exact shape.
 *
 * Story 55 — a new, read-only "Customer Satisfaction" card, appended after
 * History, reading `GET /tickets/:id/csat` via `useTicketCsatQuery`. An
 * agent never submits feedback — this card only ever shows "no feedback
 * yet" or the customer's own rating/comment, mirroring the History card's
 * loading/error/empty/populated shape.
 *
 * Story 66 — a new "Attachments" card, appended last, mirroring the Notes
 * card's own list-plus-inline-form shape: `useAttachmentsQuery` for the
 * list, `useUploadAttachmentMutation` for the file input. Download opens a
 * short-lived presigned S3 URL in a new tab (`getAttachmentDownloadUrl`) —
 * a plain top-level navigation, not a script-initiated fetch, so no CORS
 * configuration on the object-storage side is needed.
 *
 * Story 78 — a new "Live Chat" card (`TicketChatCard`), placed right after
 * the status/priority/assignment grid: unlike the read-mostly cards below
 * it, chat is a primary, frequently-used interaction surface. Extracted
 * into its own file/component from the start (mirrors `AttachmentsCard`'s
 * own precedent) rather than inlined here, since it owns real interactive
 * state (the composer) and its own realtime-merge logic. Consumes the
 * `channel.message.created` handling already added to this view's existing
 * `useTicketRealtime()` call above — no second socket connection.
 *
 * Story 79 — a new "AI Assist" card (`TicketAiCard`), mounted immediately
 * after `TicketChatCard`. Its "use as category" action reuses the same
 * `mutation` (`useUpdateTicketMutation`) this view already instantiates
 * for every other field — no second mutation instance, no new
 * category-persistence mechanism.
 */
/**
 * Story 97 — Loading & Skeleton UX. Replaces the previous generic
 * two-block skeleton (a heading bar + one body block, unrelated to this
 * page's actual shape) with one shaped to match the real, loaded layout:
 * the editable-subject header, the 5-field status/priority/category/
 * assignee/department grid, the chat card, and the run of bordered
 * sections below it (SLA/Escalations/History/CSAT/Notes/Attachments).
 * Exported so `app/[locale]/(agent)/tickets/[id]/loading.tsx` can render
 * the identical shape during the route transition itself, before this
 * component has even mounted — one skeleton definition, two call sites.
 */
export function TicketDetailSkeleton() {
  return (
    <section className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>

      <Skeleton className="h-40 w-full rounded-md" />

      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-md border border-slate-200 bg-white p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-16 w-full" />
        </div>
      ))}
    </section>
  );
}

export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  useTicketRealtime(ticketId);

  const ticketQuery = useTicketQuery(ticketId);
  const historyQuery = useTicketHistoryQuery(ticketId);
  const csatQuery = useTicketCsatQuery(ticketId);
  const slaTargetQuery = useTicketSlaTargetQuery(ticketId);
  const escalationsQuery = useTicketEscalationsQuery(ticketId);
  const notesQuery = useTicketNotesQuery(ticketId);
  const customersQuery = useCustomersQuery();
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const errorMessage = useErrorMessage();
  const mutation = useUpdateTicketMutation(ticketId);

  const [categoryDraft, setCategoryDraft] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customersQuery.data ?? []) {
      map.set(customer.id, customer.displayName);
    }
    return map;
  }, [customersQuery.data]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  if (ticketQuery.isLoading) {
    return <TicketDetailSkeleton />;
  }

  if (ticketQuery.isError) {
    const notFound = ticketQuery.error instanceof ApiError && ticketQuery.error.status === 404;
    return (
      <Alert variant="destructive">{notFound ? t("detail.notFound") : t("detail.loadError")}</Alert>
    );
  }

  const ticket = ticketQuery.data;
  if (!ticket) {
    return null;
  }
  const slaStatus = deriveSlaStatus(slaTargetQuery.data ?? null);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Input
          className="w-full max-w-md text-lg font-semibold"
          defaultValue={ticket.subject}
          aria-label={t("detail.subjectLabel")}
          onChange={(event) => setSubjectDraft(event.target.value)}
          onBlur={() => {
            const value = subjectDraft?.trim();
            if (value && subjectDraft !== ticket.subject) {
              mutation.mutate({ subject: value });
            }
          }}
        />
        <p className="text-sm text-slate-500">
          {t("detail.customer")}:{" "}
          <button
            type="button"
            className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={() => router.push(`/${locale}/customers/${ticket.customerId}`)}
          >
            {customerNameById.get(ticket.customerId) ?? ticket.customerId}
          </button>
        </p>
      </div>

      {mutation.isError && (
        <Alert variant="destructive">
          {errorMessage(mutation.error, {
            forbidden: t("detail.actionForbidden"),
            generic: t("detail.actionFailed"),
          })}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("detail.status")}>
          <Select
            value={ticket.status}
            disabled={mutation.isPending}
            onValueChange={(value) =>
              mutation.mutate(
                { status: value as TicketStatus },
                { onSuccess: () => showSuccessToast(t("detail.statusUpdateSuccess", { status: value })) },
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("detail.priority")}>
          <Select
            value={ticket.priority}
            disabled={mutation.isPending}
            onValueChange={(value) =>
              mutation.mutate(
                { priority: value as TicketPriority },
                {
                  onSuccess: () =>
                    showSuccessToast(t("detail.priorityUpdateSuccess", { priority: value })),
                },
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("detail.category")}>
          <Input
            defaultValue={ticket.category ?? ""}
            onChange={(event) => setCategoryDraft(event.target.value)}
            onBlur={() => {
              if (categoryDraft !== null && categoryDraft !== (ticket.category ?? "")) {
                mutation.mutate({ category: categoryDraft });
              }
            }}
          />
        </Field>

        <Field label={t("detail.assignedAgent")}>
          <Select
            value={ticket.assignedToUserId ?? undefined}
            disabled={mutation.isPending || usersQuery.isLoading}
            onValueChange={(value) => mutation.mutate({ assignedToUserId: value })}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={usersQuery.isLoading ? t("detail.optionsLoading") : t("list.unassigned")}
              />
            </SelectTrigger>
            <SelectContent>
              {(usersQuery.data ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("detail.department")}>
          <Select
            value={ticket.departmentId ?? undefined}
            disabled={mutation.isPending || departmentsQuery.isLoading}
            onValueChange={(value) => mutation.mutate({ departmentId: value })}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  departmentsQuery.isLoading ? t("detail.optionsLoading") : t("detail.noDepartment")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(departmentsQuery.data ?? []).map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departmentsQuery.isError && (
            <span className="text-xs text-red-600">{t("detail.departmentLoadError")}</span>
          )}
        </Field>
      </div>

      <TicketChatCard ticketId={ticketId} />

      <TicketAiCard
        ticketId={ticketId}
        onApplyCategory={(category) => mutation.mutate({ category })}
      />

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.slaHeading")}</h2>
        {slaTargetQuery.isLoading && <Skeleton className="mt-2 h-5 w-40" />}
        {slaTargetQuery.isSuccess && slaStatus.kind === "none" && (
          <p className="mt-1 text-sm text-slate-500">{t("sla.none")}</p>
        )}
        {slaTargetQuery.isSuccess && slaStatus.kind === "breached" && (
          <Badge variant="destructive" className="mt-2">
            {t("sla.breachedAt", { time: new Date(slaStatus.targetAt).toLocaleString(locale) })}
          </Badge>
        )}
        {slaTargetQuery.isSuccess && slaStatus.kind === "on-track" && (
          <p className="mt-1 text-sm text-slate-700">
            {t("sla.remaining", { time: formatRemaining(slaStatus.remainingMs) })}
          </p>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.escalationsHeading")}</h2>
        {escalationsQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {escalationsQuery.isError && (
          <Alert variant="destructive" className="mt-2">{t("detail.escalationsError")}</Alert>
        )}
        {escalationsQuery.isSuccess && escalationsQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.escalationsEmpty")}</p>
        )}
        {escalationsQuery.isSuccess && escalationsQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {escalationsQuery.data.map((escalation) => {
              const targetTypeLabelKey = TARGET_TYPE_LABEL_KEYS[escalation.targetType];
              return (
                <li key={escalation.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-medium text-slate-800">
                    {targetTypeLabelKey ? t(targetTypeLabelKey) : escalation.targetType}
                  </span>
                  <span className="text-slate-500">
                    {new Date(escalation.escalatedAt).toLocaleString(locale)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.historyHeading")}</h2>
        {historyQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {historyQuery.isError && <Alert variant="destructive" className="mt-2">{t("detail.historyError")}</Alert>}
        {historyQuery.isSuccess && historyQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.historyEmpty")}</p>
        )}
        {historyQuery.isSuccess && historyQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {historyQuery.data.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-800">{entry.eventType}</span>
                <span className="text-slate-500">{new Date(entry.createdAt).toLocaleString(locale)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.csatHeading")}</h2>
        {csatQuery.isLoading && <Skeleton className="mt-2 h-5 w-40" />}
        {csatQuery.isError && (
          <Alert variant="destructive" className="mt-2">{t("detail.csatError")}</Alert>
        )}
        {csatQuery.isSuccess && !csatQuery.data && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.csatEmpty")}</p>
        )}
        {csatQuery.isSuccess && csatQuery.data && (
          <div className="mt-2 flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">
              {t("detail.csatRatingLabel", { rating: csatQuery.data.rating })}
            </span>
            {csatQuery.data.comment && (
              <p className="text-slate-700">{csatQuery.data.comment}</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.notesHeading")}</h2>
        {notesQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {notesQuery.isError && (
          <Alert variant="destructive" className="mt-2">{t("detail.notesError")}</Alert>
        )}
        {notesQuery.isSuccess && notesQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.notesEmpty")}</p>
        )}
        {notesQuery.isSuccess && notesQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {notesQuery.data.map((note) => (
              <li key={note.id} className="border-b border-slate-100 pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    {userNameById.get(note.authorUserId) ?? note.authorUserId}
                  </span>
                  <span className="text-slate-500">
                    {new Date(note.createdAt).toLocaleString(locale)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
        <AddNoteForm ticketId={ticketId} />
      </div>

      <AttachmentsCard
        owner={{ type: "ticket", id: ticketId }}
        locale={locale}
        strings={{
          heading: t("detail.attachmentsHeading"),
          error: t("detail.attachmentsError"),
          empty: t("detail.attachmentsEmpty"),
          uploading: t("detail.attachmentsUploading"),
          uploadFailedFallback: t("detail.attachmentsUploadFailed"),
        }}
      />
    </section>
  );
}

/**
 * The smallest UI surface for a one-field create (Design item 8) — an
 * inline textarea + submit button below the notes list, mirroring
 * `AddDepartmentForm`'s submit/error-handling pattern.
 */
function AddNoteForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateTicketNoteMutation(ticketId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ body: body.trim() });
      setBody("");
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.notesCreateFailed"),
        }),
      );
    }
  }

  return (
    <form className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
      <textarea
        className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        rows={3}
        value={body}
        placeholder={t("detail.notesPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
      />
      <div>
        <Button type="submit" size="sm" disabled={mutation.isPending || !body.trim()}>
          {mutation.isPending ? t("detail.notesSubmitting") : t("detail.notesSubmit")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      {children}
    </label>
  );
}
