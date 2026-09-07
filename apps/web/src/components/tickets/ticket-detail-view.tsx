"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCreateTicketNoteMutation,
  useDepartmentsQuery,
  useHoldTicketMutation,
  useResumeTicketMutation,
  useTicketCsatQuery,
  useTicketEscalationsQuery,
  useTicketHistoryQuery,
  useTicketNotesQuery,
  useTicketQuery,
  useTicketSlaTargetQuery,
  useUpdateTicketMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { AttachmentsCard } from "@/components/attachments/attachments-card";
import { CustomerContextPanel } from "@/components/tickets/customer-context-panel";
import { TicketChatCard } from "@/components/tickets/ticket-chat-card";
import { TicketAiCard } from "@/components/tickets/ticket-ai-card";
import { TicketKbReferencesCard } from "@/components/tickets/ticket-kb-references-card";
import { useTicketRealtime } from "@/hooks/use-ticket-realtime";
import { useAgentPresence } from "@/hooks/use-agent-presence";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Badge, Button, Input, showSuccessToast, Skeleton } from "@crm/ui";
import type { TicketPriority, TicketStatus } from "@/lib/tickets-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
 * `useUsersQuery()` data. (It used to mirror a `customerNameById` memo
 * of the same shape; Story S-8d removed that one — see below.)
 *
 * Story 55 — a new, read-only "Customer Satisfaction" card, appended after
 * History, reading `GET /tickets/:id/csat` via `useTicketCsatQuery`. An
 * agent never submits feedback — this card only ever shows "no feedback
 * yet" or the customer's own rating/comment, mirroring the History card's
 * loading/error/empty/populated shape.
 *
 * Story 66 — a new "Attachments" card, mirroring the Notes card's own
 * list-plus-inline-form shape: `useAttachmentsQuery` for the list,
 * `useUploadAttachmentMutation` for the file input. Download opens a
 * short-lived presigned S3 URL in a new tab (`getAttachmentDownloadUrl`) —
 * a plain top-level navigation, not a script-initiated fetch, so no CORS
 * configuration on the object-storage side is needed.
 *
 * RM-05 — a new "Knowledge Base References" card (`TicketKbReferencesCard`),
 * appended last: a read-only list of `PUBLISHED` articles attached to this
 * ticket (each removable) plus an inline search-and-attach widget over
 * `GET /knowledge-base/articles?status=PUBLISHED`. Closes the one
 * confirmed-zero cross-link between Ticketing and Knowledge Base — an
 * agent no longer has to leave the ticket to find and reference relevant
 * KB content.
 *
 * RM-06 — extends Story 108's presence foundation (deliberately scoped
 * there to the Users admin list only) into this screen's own assignee
 * picker: each option now shows the same online/offline `Badge`
 * `UserListView` already renders, via the same `useAgentPresence` hook —
 * no new presence-tracking mechanism, just a second consumer. The note
 * composer (`AddNoteForm`) also gains a basic `@mention` affordance —
 * see that function's own doc comment.
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
 *
 * Story 120 — the free-text category `Input` became a `Select` sourced
 * from `useTicketCategoriesQuery()` (mirrors the `department` field's own
 * `Select` immediately below it). `TicketAiCard`'s AI-suggested category
 * text is resolved here to an existing category by exact,
 * case-insensitive name match — applied via the same `mutation` when one
 * exists; when none matches, a message points the agent at the Ticket
 * Categories screen instead of silently failing or auto-creating one (see
 * `TicketCategoriesService`'s own doc comment for why creation stays a
 * deliberate, separate action).
 *
 * Story S-8d — the customer name arrives on the ticket itself instead of
 * being looked up in a map built from the whole customer list, so this
 * screen no longer fetches that list at all.
 *
 * RM-04 — a new `CustomerContextPanel`, mounted right after the header
 * (highest-visibility spot, before any editable field): the customer's
 * other still-open tickets and primary contacts, so an agent never has to
 * leave this screen to answer "does this customer have other open
 * issues?" or "who else can I call?". Pure frontend composition of two
 * already-existing, already-scoped endpoints (`GET /tickets?customerId=`,
 * `GET /customers/:id`) — no new endpoint, no new permission.
 */
/**
 * Story 97 — Loading & Skeleton UX. Replaces the previous generic
 * two-block skeleton (a heading bar + one body block, unrelated to this
 * page's actual shape) with one shaped to match the real, loaded layout:
 * the editable-subject header, the customer context panel (RM-04), the
 * 5-field status/priority/category/assignee/department grid, the chat
 * card, and the run of bordered sections below it (SLA/Escalations/
 * History/CSAT/Notes/Attachments/KB References — RM-05 added the last).
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

      {/* RM-04 — the customer context panel. */}
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-16 w-full" />
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

      {Array.from({ length: 7 }).map((_, index) => (
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

  useTicketRealtime(ticketId);

  const ticketQuery = useTicketQuery(ticketId);
  const historyQuery = useTicketHistoryQuery(ticketId);
  const csatQuery = useTicketCsatQuery(ticketId);
  const slaTargetQuery = useTicketSlaTargetQuery(ticketId);
  const escalationsQuery = useTicketEscalationsQuery(ticketId);
  const notesQuery = useTicketNotesQuery(ticketId);
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const categoriesQuery = useTicketCategoriesQuery();
  const errorMessage = useErrorMessage();
  const mutation = useUpdateTicketMutation(ticketId);
  // RM-25 — SLA Pause/Resume.
  const holdMutation = useHoldTicketMutation(ticketId);
  const resumeMutation = useResumeTicketMutation(ticketId);

  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  const [aiCategoryNoMatch, setAiCategoryNoMatch] = useState<string | null>(null);
  const [confirmHoldOpen, setConfirmHoldOpen] = useState(false);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  // RM-06 — Workspace Presence. Mirrors `UserListView`'s own
  // `userIds`/`useAgentPresence` pattern exactly.
  const userIds = useMemo(() => (usersQuery.data ?? []).map((user) => user.id), [usersQuery.data]);
  const presence = useAgentPresence(userIds);

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
        {/* NAV-2 — no visible heading exists on this page (the subject is
            an editable Input, not static text), so a keyboard/screen-reader
            user navigating by heading level got nothing. Visually hidden:
            the Input's own aria-label is still the visible control's
            accessible name; this only adds the missing document-outline
            landmark. */}
        <h1 className="sr-only">{ticket.subject}</h1>
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
          <Link
            href={`/${locale}/customers/${ticket.customerId}`}
            className="focus-ring rounded-sm hover:underline"
          >
            {/* Story S-8d — resolved by the API. */}
            {ticket.customerName ?? ticket.customerId}
          </Link>
        </p>
      </div>

      <CustomerContextPanel ticketId={ticketId} customerId={ticket.customerId} />

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
                {
                  onSuccess: () =>
                    showSuccessToast(t("detail.statusUpdateSuccess", { status: value })),
                },
              )
            }
          >
            <SelectTrigger aria-label={t("detail.status")}>
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
            <SelectTrigger aria-label={t("detail.priority")}>
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
          <Select
            value={ticket.categoryId ?? undefined}
            disabled={mutation.isPending || categoriesQuery.isLoading}
            onValueChange={(value) => mutation.mutate({ categoryId: value })}
          >
            <SelectTrigger aria-label={t("detail.category")}>
              <SelectValue
                placeholder={
                  categoriesQuery.isLoading ? t("detail.optionsLoading") : t("detail.noCategory")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(categoriesQuery.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoriesQuery.isError && (
            <span className="text-xs text-red-600">{t("detail.categoryLoadError")}</span>
          )}
        </Field>

        <Field label={t("detail.assignedAgent")}>
          <Select
            value={ticket.assignedToUserId ?? undefined}
            disabled={mutation.isPending || usersQuery.isLoading}
            onValueChange={(value) => mutation.mutate({ assignedToUserId: value })}
          >
            <SelectTrigger aria-label={t("detail.assignedAgent")}>
              <SelectValue
                placeholder={
                  usersQuery.isLoading ? t("detail.optionsLoading") : t("list.unassigned")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(usersQuery.data ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{user.fullName}</span>
                    {/* RM-06 — mirrors `UserListView`'s own presence Badge shape,
                        just under this namespace's own key names. */}
                    <Badge variant={presence[user.id] === "online" ? "success" : "secondary"}>
                      {presence[user.id] === "online"
                        ? t("detail.presenceOnline")
                        : t("detail.presenceOffline")}
                    </Badge>
                  </span>
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
            <SelectTrigger aria-label={t("detail.department")}>
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
        onApplyCategory={(suggested) => {
          const match = (categoriesQuery.data ?? []).find(
            (category) => category.name.toLowerCase() === suggested.trim().toLowerCase(),
          );
          if (match) {
            setAiCategoryNoMatch(null);
            mutation.mutate({ categoryId: match.id });
          } else {
            setAiCategoryNoMatch(suggested);
          }
        }}
      />
      {aiCategoryNoMatch && (
        <Alert>
          {t("detail.aiCategoryNoMatch", { category: aiCategoryNoMatch })}{" "}
          <Link className="underline" href={`/${locale}/ticket-categories`}>
            {t("detail.aiCategoryNoMatchLink")}
          </Link>
        </Alert>
      )}

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
        {/* RM-25 — SLA Pause/Resume. Shown instead of a ticking countdown
            while held: the clock genuinely isn't advancing, so a countdown
            here would misrepresent it. */}
        {slaTargetQuery.isSuccess && slaStatus.kind === "on-hold" && (
          <Badge variant="secondary" className="mt-2">
            {t("sla.onHoldSince", { time: slaStatus.onHoldSince.toLocaleString(locale) })}
          </Badge>
        )}
        {slaTargetQuery.isSuccess && slaStatus.kind !== "none" && (
          <div className="mt-2">
            {slaStatus.kind === "on-hold" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={resumeMutation.isPending}
                onClick={() => resumeMutation.mutate()}
              >
                {t("sla.resume")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={holdMutation.isPending}
                onClick={() => setConfirmHoldOpen(true)}
              >
                {t("sla.placeOnHold")}
              </Button>
            )}
            <ConfirmDialog
              open={confirmHoldOpen}
              onOpenChange={setConfirmHoldOpen}
              title={t("sla.holdConfirmTitle")}
              description={t("sla.holdConfirmDescription")}
              confirmLabel={t("sla.placeOnHold")}
              onConfirm={() => holdMutation.mutate(undefined, { onSuccess: () => setConfirmHoldOpen(false) })}
              isPending={holdMutation.isPending}
            />
            {(holdMutation.isError || resumeMutation.isError) && (
              <p className="mt-1 text-xs text-red-600">
                {errorMessage(holdMutation.error ?? resumeMutation.error, {
                  forbidden: t("sla.actionForbidden"),
                  generic: t("sla.actionFailed"),
                })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.escalationsHeading")}</h2>
        {escalationsQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {escalationsQuery.isError && (
          <Alert variant="destructive" className="mt-2">
            {t("detail.escalationsError")}
          </Alert>
        )}
        {escalationsQuery.isSuccess && escalationsQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.escalationsEmpty")}</p>
        )}
        {escalationsQuery.isSuccess && escalationsQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {escalationsQuery.data.map((escalation) => {
              const targetTypeLabelKey = TARGET_TYPE_LABEL_KEYS[escalation.targetType];
              return (
                <li
                  key={escalation.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2"
                >
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
        {historyQuery.isError && (
          <Alert variant="destructive" className="mt-2">
            {t("detail.historyError")}
          </Alert>
        )}
        {historyQuery.isSuccess && historyQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.historyEmpty")}</p>
        )}
        {historyQuery.isSuccess && historyQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {historyQuery.data.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between border-b border-slate-100 pb-2"
              >
                <span className="font-medium text-slate-800">{entry.eventType}</span>
                <span className="text-slate-500">
                  {new Date(entry.createdAt).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.csatHeading")}</h2>
        {csatQuery.isLoading && <Skeleton className="mt-2 h-5 w-40" />}
        {csatQuery.isError && (
          <Alert variant="destructive" className="mt-2">
            {t("detail.csatError")}
          </Alert>
        )}
        {csatQuery.isSuccess && !csatQuery.data && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.csatEmpty")}</p>
        )}
        {csatQuery.isSuccess && csatQuery.data && (
          <div className="mt-2 flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">
              {t("detail.csatRatingLabel", { rating: csatQuery.data.rating })}
            </span>
            {csatQuery.data.comment && <p className="text-slate-700">{csatQuery.data.comment}</p>}
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.notesHeading")}</h2>
        {notesQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {notesQuery.isError && (
          <Alert variant="destructive" className="mt-2">
            {t("detail.notesError")}
          </Alert>
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

      <TicketKbReferencesCard ticketId={ticketId} />
    </section>
  );
}

/**
 * The smallest UI surface for a one-field create (Design item 8) — an
 * inline textarea + submit button below the notes list, mirroring
 * `AddDepartmentForm`'s submit/error-handling pattern.
 *
 * RM-06 — a basic `@mention` affordance (the plan's own words: "not a
 * full rich-text mentions UI"), deliberately simple: only the trailing
 * `@word...` run at the very end of the body is ever treated as an active
 * mention trigger (a boundary check requires the `@` itself to be at the
 * start of the note or preceded by whitespace, mirroring the backend
 * parser's own boundary rule in `ticket-mentions.ts`) — no arbitrary
 * cursor-position tracking mid-string, matching this affordance's own
 * "basic" scope. Picking a suggestion inserts the exact `fullName` the
 * backend's `parseMentions` matches against, so what an agent picks here
 * is always what gets resolved server-side.
 */
function AddNoteForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateTicketNoteMutation(ticketId);
  const usersQuery = useUsersQuery();
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const mentionQuery = useMemo(() => {
    const lastAt = body.lastIndexOf("@");
    if (lastAt === -1) {
      return null;
    }
    const charBefore = body[lastAt - 1];
    if (charBefore !== undefined && !/\s/.test(charBefore)) {
      return null; // `@` mid-word — never a mention trigger.
    }
    const rest = body.slice(lastAt + 1);
    return /\s/.test(rest) ? null : rest;
  }, [body]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null || suggestionsDismissed) {
      return [];
    }
    const query = mentionQuery.toLowerCase();
    return (usersQuery.data ?? [])
      .filter((user) => user.fullName.toLowerCase().includes(query))
      .slice(0, 5);
  }, [mentionQuery, suggestionsDismissed, usersQuery.data]);

  function selectMention(fullName: string): void {
    const lastAt = body.lastIndexOf("@");
    if (lastAt === -1) {
      return;
    }
    setBody(`${body.slice(0, lastAt)}@${fullName} `);
  }

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
    <form className="relative mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
      <textarea
        className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-ink-subtle focus-ring"
        rows={3}
        value={body}
        placeholder={t("detail.notesPlaceholder")}
        onChange={(event) => {
          setSuggestionsDismissed(false);
          setBody(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && mentionMatches.length > 0) {
            setSuggestionsDismissed(true);
          }
        }}
      />
      {mentionMatches.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-md">
          {mentionMatches.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 focus-ring"
                onClick={() => selectMention(user.fullName)}
              >
                {user.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
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
