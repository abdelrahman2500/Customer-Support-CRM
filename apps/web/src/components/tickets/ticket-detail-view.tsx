"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import {
  useCurrentUserQuery,
  useDepartmentsQuery,
  useHoldTicketMutation,
  useResumeTicketMutation,
  useTicketCsatQuery,
  useTicketQuery,
  useTicketSlaTargetQuery,
  useUpdateTicketMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { AttachmentsCard } from "@/components/attachments/attachments-card";
import { CustomerContextPanel } from "@/components/tickets/customer-context-panel";
import { TicketChatCard } from "@/components/tickets/ticket-chat-card";
import type { ReplyInsertion } from "@/components/tickets/ticket-chat-card";
import { TicketAiCard } from "@/components/tickets/ticket-ai-card";
import { TicketKbReferencesCard } from "@/components/tickets/ticket-kb-references-card";
import { useTicketRealtime } from "@/hooks/use-ticket-realtime";
import { useAgentPresence } from "@/hooks/use-agent-presence";
import { deriveSlaStatus } from "@/lib/sla";
import { SlaIndicator } from "@/components/tickets/sla-indicator";
import { TicketHeader, TicketHeaderActions } from "@/components/tickets/ticket-header";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Avatar,
  Button,
  Combobox,
  type ComboboxOption,
  Card,
  DescriptionItem,
  DescriptionList,
  LoadingStatus,
  SectionCard,
  showSuccessToast,
  Skeleton,
} from "@crm/ui";
import type { TicketPriority, TicketStatus } from "@/lib/tickets-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

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
      <Card className="p-surface">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-16 w-full" />
      </Card>

      <Card className="grid grid-cols-1 gap-4 p-surface sm:grid-cols-2 lg:grid-cols-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </Card>

      <Skeleton className="h-40 w-full rounded-md" />

      {Array.from({ length: 7 }).map((_, index) => (
        <Card key={index} className="p-surface">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-16 w-full" />
        </Card>
      ))}
    </section>
  );
}

export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const ticketLabels = useTicketLabels();
  const { locale } = useParams<{ locale: string }>();

  useTicketRealtime(ticketId);

  const ticketQuery = useTicketQuery(ticketId);
  const csatQuery = useTicketCsatQuery(ticketId);
  const slaTargetQuery = useTicketSlaTargetQuery(ticketId);
  const usersQuery = useUsersQuery();
  // Story 202 (RD-3.2) — "Assign to me" needs the agent's own id.
  const currentUserQuery = useCurrentUserQuery();
  const departmentsQuery = useDepartmentsQuery();
  const categoriesQuery = useTicketCategoriesQuery();
  const errorMessage = useErrorMessage();
  const mutation = useUpdateTicketMutation(ticketId);
  // RM-25 — SLA Pause/Resume.
  const holdMutation = useHoldTicketMutation(ticketId);
  const resumeMutation = useResumeTicketMutation(ticketId);

  // Story 201 (RD-3.1) — the subject edit state (Stories 42/156/166) moved,
  // verbatim, into TicketHeader along with the heading it edits.
  const [aiCategoryNoMatch, setAiCategoryNoMatch] = useState<string | null>(null);
  // Story 208 — an AI-suggested reply on its way into the composer's draft.
  const [replyInsertion, setReplyInsertion] = useState<ReplyInsertion | null>(null);

  /** Story 203 (RD-3.3) — the inspector sticks just under the sticky ticket
   * header, whose height varies (subject length, wrapped facts, actions).
   * Measured in place — wrapping the header would break its own `sticky` —
   * and exposed as `--ticket-header-h`. Without ResizeObserver (jsdom) the
   * variable falls back to 0px. */
  const workspaceRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const ticketLoaded = ticketQuery.data !== undefined;
  useEffect(() => {
    const header = workspaceRef.current?.querySelector(":scope > header");
    if (!header || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setHeaderHeight(Math.ceil(header.getBoundingClientRect().height)),
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [ticketLoaded]);
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
    return (
      <LoadingStatus label={tCommon("loading")} placeholderHidden={false}>
        <TicketDetailSkeleton />
      </LoadingStatus>
    );
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

  /** Story 202 (RD-3.2) — the one status and assignee code path. The
   * inspector Selects and the header actions both call these, so an action
   * sends exactly the field's request and shows exactly its toast; a
   * rejection lands in the shared error Alert below the header. */
  function updateStatus(value: TicketStatus) {
    mutation.mutate(
      { status: value },
      {
        onSuccess: () =>
          showSuccessToast(t("detail.statusUpdateSuccess", { status: ticketLabels.status(value) })),
      },
    );
  }
  function updateAssignee(value: string) {
    mutation.mutate(
      { assignedToUserId: value },
      {
        onSuccess: () =>
          showSuccessToast(
            t("detail.assignedAgentUpdateSuccess", { agent: userNameById.get(value) ?? value }),
          ),
      },
    );
  }
  const currentUserId = currentUserQuery.data?.id;

  /** Story 204 (RD-3.4) — the assignee options: avatar (with presence dot),
   * name, presence as text; the current agent first, marked "(you)". */
  const assigneeOptions: ComboboxOption[] = [...(usersQuery.data ?? [])]
    .sort((a, b) => Number(b.id === currentUserId) - Number(a.id === currentUserId))
    .map((user) => {
      const online = presence[user.id] === "online";
      return {
        value: user.id,
        label:
          user.id === currentUserId
            ? `${user.fullName} (${t("detail.assigneeYou")})`
            : user.fullName,
        // RM-06 — the same presence words as before, now as text in the name.
        description: online ? t("detail.presenceOnline") : t("detail.presenceOffline"),
        leading: (
          <Avatar
            name={user.fullName}
            size="sm"
            presence={online ? "online" : "offline"}
            decorative
          />
        ),
      };
    });

  return (
    <section
      ref={workspaceRef}
      className="flex flex-col gap-6"
      style={{ "--ticket-header-h": `${headerHeight}px` } as CSSProperties}
    >
      {/* Story 201 (RD-3.1, recon TW-01) — identity and state at a glance:
          back link, short id, the subject h1 (its inline edit unchanged),
          status, priority, SLA, assignee, customer and times; sticky at lg. */}
      <TicketHeader
        ticket={ticket}
        locale={locale}
        sla={
          slaTargetQuery.isSuccess
            ? { status: "ready", target: slaTargetQuery.data ?? null }
            : slaTargetQuery.isError
              ? { status: "error" }
              : { status: "loading" }
        }
        assigneeName={
          ticket.assignedToUserId
            ? (userNameById.get(ticket.assignedToUserId) ?? ticket.assignedToUserId)
            : null
        }
        assigneePresence={
          ticket.assignedToUserId
            ? presence[ticket.assignedToUserId] === "online"
              ? "online"
              : "offline"
            : undefined
        }
        onSubjectCommit={(subject, { onError }) => mutation.mutate({ subject }, { onError })}
        actions={
          <TicketHeaderActions
            status={ticket.status}
            canAssignToMe={!!currentUserId && ticket.assignedToUserId !== currentUserId}
            pending={mutation.isPending}
            onAssignToMe={() => currentUserId && updateAssignee(currentUserId)}
            onSetStatus={updateStatus}
          />
        }
      />

      {mutation.isError && (
        <Alert variant="destructive">
          {errorMessage(mutation.error, {
            forbidden: t("detail.actionForbidden"),
            generic: t("detail.actionFailed"),
          })}
        </Alert>
      )}

      {/* Story 156 — a two-column workspace on desktop, one column below `lg`.

          The page was eleven equally-weighted full-width cards in a single
          stack, with the conversation fifth: an agent scrolled past the
          customer panel and a four-column metadata grid to reach the thing
          they came to read, then past seven more cards below it.

          Main column holds the conversation and everything an agent WRITES
          (AI assist, notes, attachments, KB references). Side column holds
          what they READ or set once (metadata, customer context, SLA,
          escalations, history, CSAT). Nothing is hidden and nothing moved
          behind a tab — the order changed, not the content.

          `items-start` so the columns size independently instead of the
          shorter one stretching. Below `lg` the grid is one column and the
          main column renders first, so a phone opens on the conversation. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          {/* Story 206 (RD-3.6, recon TW-04) — the conversation is the ticket's
              timeline: notes, history and SLA escalations now sit in it, in
              time order, instead of three cards of their own. Story 207
              (RD-3.7) — its one composer writes replies and internal notes. */}
          <TicketChatCard ticketId={ticketId} replyInsertion={replyInsertion} />

          <TicketAiCard
            ticketId={ticketId}
            // Story 208 (RD-3.8, recon TW-06) — into the reply draft, unsent.
            onInsertReply={(text) => setReplyInsertion({ text, id: Date.now() })}
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

          <AttachmentsCard
            owner={{ type: "ticket", id: ticketId }}
            locale={locale}
            strings={{
              heading: t("detail.attachmentsHeading"),
              error: t("detail.attachmentsError"),
              empty: t("detail.attachmentsEmpty"),
              uploading: t("detail.attachmentsUploading"),
              uploadFailedFallback: t("detail.attachmentsUploadFailed"),
              uploadForbidden: t("detail.actionForbidden"),
              uploadLabel: t("detail.attachmentsUploadLabel"),
              dropHint: t("detail.attachmentsDropHint"),
            }}
          />

          <TicketKbReferencesCard ticketId={ticketId} />
        </div>

        {/* Story 203 (RD-3.3, recon TW-02) — the inspector: from lg it stays
            beside the conversation, just under the sticky ticket header, and
            scrolls on its own. Its max height also leaves out the page's
            bottom gutter (`--space-page-y`), so at the very end of the page —
            where sticky lets go at the grid's edge — it never slides under
            the header. `-mx-1 px-1` keeps focus rings at the card edges from
            being clipped by the scroll container. */}
        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-[var(--ticket-header-h,0px)] lg:-mx-1 lg:max-h-[calc(100vh_-_var(--ticket-header-h,0px)_-_var(--space-page-y))] lg:overflow-y-auto lg:px-1 lg:pb-stack">
          {/* Story 203 (RD-3.3, recon TW-07) — the properties card has a
              heading now (it was the one untitled card, breaking the
              outline); the five controls inside are unchanged. */}
          <SectionCard title={t("detail.propertiesHeading")} collapsible>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Field label={t("detail.status")}>
                <Select
                  value={ticket.status}
                  disabled={mutation.isPending}
                  onValueChange={(value) => updateStatus(value as TicketStatus)}
                >
                  <SelectTrigger aria-label={t("detail.status")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Story 153 — `value` stays the raw enum (it is what the
                      mutation sends to the API); only the visible text is
                      localized. `SelectValue` above renders the selected
                      item's children, so the trigger follows automatically. */}
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {ticketLabels.status(option)}
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
                          showSuccessToast(
                            t("detail.priorityUpdateSuccess", {
                              priority: ticketLabels.priority(value),
                            }),
                          ),
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
                        {ticketLabels.priority(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t("detail.category")}>
                <Select
                  value={ticket.categoryId ?? undefined}
                  disabled={mutation.isPending || categoriesQuery.isLoading}
                  onValueChange={(value) =>
                    mutation.mutate(
                      { categoryId: value },
                      {
                        // Batch 5 (UX audit) — mirrors the status/priority Selects
                        // just above: every immediate-commit field on this page
                        // now confirms itself the same way, not just two of five.
                        onSuccess: () => {
                          const category = (categoriesQuery.data ?? []).find((c) => c.id === value);
                          showSuccessToast(
                            t("detail.categoryUpdateSuccess", {
                              category: category?.name ?? value,
                            }),
                          );
                        },
                      },
                    )
                  }
                >
                  <SelectTrigger aria-label={t("detail.category")}>
                    <SelectValue
                      placeholder={
                        categoriesQuery.isLoading
                          ? t("detail.optionsLoading")
                          : t("detail.noCategory")
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
                  <span className="text-xs text-danger-foreground">
                    {t("detail.categoryLoadError")}
                  </span>
                )}
              </Field>

              <Field label={t("detail.assignedAgent")}>
                {/* Story 204 (RD-3.4, recon TW-08) — a searchable picker: type to
                    filter, arrow keys, presence as text in each option's name,
                    the current agent first and marked. Same updateAssignee
                    (PATCH + toast) as before. No "Unassigned"/clear option:
                    the PATCH does not accept null (recon, Story 204). */}
                <Combobox
                  aria-label={t("detail.assignedAgent")}
                  value={ticket.assignedToUserId ?? undefined}
                  disabled={mutation.isPending || usersQuery.isLoading}
                  onValueChange={updateAssignee}
                  placeholder={
                    usersQuery.isLoading ? t("detail.optionsLoading") : t("list.unassigned")
                  }
                  searchLabel={t("detail.assigneeSearch")}
                  emptyText={t("detail.assigneeNoMatch")}
                  options={assigneeOptions}
                />
              </Field>

              <Field label={t("detail.department")}>
                <Select
                  value={ticket.departmentId ?? undefined}
                  disabled={mutation.isPending || departmentsQuery.isLoading}
                  onValueChange={(value) =>
                    mutation.mutate(
                      { departmentId: value },
                      {
                        onSuccess: () => {
                          const department = (departmentsQuery.data ?? []).find(
                            (d) => d.id === value,
                          );
                          showSuccessToast(
                            t("detail.departmentUpdateSuccess", {
                              department: department?.name ?? value,
                            }),
                          );
                        },
                      },
                    )
                  }
                >
                  <SelectTrigger aria-label={t("detail.department")}>
                    <SelectValue
                      placeholder={
                        departmentsQuery.isLoading
                          ? t("detail.optionsLoading")
                          : t("detail.noDepartment")
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
                  <span className="text-xs text-danger-foreground">
                    {t("detail.departmentLoadError")}
                  </span>
                )}
              </Field>
            </div>
            <DescriptionList className="mt-4">
              <DescriptionItem term={t("detail.ticketIdFull")}>
                <span className="break-all font-mono text-caption" dir="ltr">
                  {ticket.id}
                </span>
              </DescriptionItem>
            </DescriptionList>
          </SectionCard>

          <CustomerContextPanel ticketId={ticketId} customerId={ticket.customerId} collapsible />

          <SectionCard title={t("detail.slaHeading")} collapsible>
            {slaTargetQuery.isLoading && (
              <LoadingStatus label={tCommon("loading")} asChild>
                <Skeleton className="mt-2 h-5 w-40" />
              </LoadingStatus>
            )}
            {/* Story 192 (RD-1.15) — SlaIndicator: governing target, the
                at-risk tier and a localized duration. RM-25: while held it
                shows "on hold since", never a countdown for a paused clock. */}
            {slaTargetQuery.isSuccess && (
              <SlaIndicator
                variant="detail"
                target={slaTargetQuery.data ?? null}
                createdAt={ticket.createdAt}
              />
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
                  onConfirm={() =>
                    holdMutation.mutate(undefined, { onSuccess: () => setConfirmHoldOpen(false) })
                  }
                  isPending={holdMutation.isPending}
                />
                {(holdMutation.isError || resumeMutation.isError) && (
                  <p className="mt-1 text-xs text-danger-foreground">
                    {errorMessage(holdMutation.error ?? resumeMutation.error, {
                      forbidden: t("sla.actionForbidden"),
                      generic: t("sla.actionFailed"),
                    })}
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t("detail.csatHeading")} collapsible>
            {csatQuery.isLoading && (
              <LoadingStatus label={tCommon("loading")} asChild>
                <Skeleton className="mt-2 h-5 w-40" />
              </LoadingStatus>
            )}
            {csatQuery.isError && (
              <Alert variant="destructive" className="mt-2">
                {t("detail.csatError")}
              </Alert>
            )}
            {csatQuery.isSuccess && !csatQuery.data && (
              <p className="mt-2 text-sm text-ink-subtle">{t("detail.csatEmpty")}</p>
            )}
            {csatQuery.isSuccess && csatQuery.data && (
              <div className="mt-2 flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink-strong">
                  {t("detail.csatRatingLabel", { rating: csatQuery.data.rating })}
                </span>
                {csatQuery.data.comment && (
                  <p className="text-ink-strong">{csatQuery.data.comment}</p>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      {children}
    </label>
  );
}
