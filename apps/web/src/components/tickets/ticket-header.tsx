"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Avatar,
  BackLink,
  Button,
  DescriptionItem,
  Input,
  Skeleton,
  cn,
  formatDateTime,
  type AvatarPresence,
} from "@crm/ui";
import type { TicketSlaTarget } from "@/lib/sla";
import type { TicketStatus, TicketSummary } from "@/lib/tickets-api";
import { SlaIndicator } from "./sla-indicator";
import { ConfirmDialog } from "../confirm-dialog";
import { TicketPriorityBadge, TicketStatusBadge } from "./ticket-badges";
import { statusSpine } from "./board/board-state";
import { useTicketLabels } from "@/hooks/use-ticket-labels";

/** Story 219 (RD-3.13) — the header fields whose change by someone else is cued. */
export type TicketHeaderField = "status" | "priority" | "assignee";

/** How long a changed field keeps its cue (the board uses the same). */
const CUE_MS = 2400;
const CUE_CLASS =
  "rounded-pill motion-safe:animate-change-cue motion-reduce:ring-2 motion-reduce:ring-accent/50";

/**
 * Story 201 (RD-3.1, recon TW-01) — the ticket's identity and state at a
 * glance. Before this the page opened on a bare subject and a "Customer:"
 * line; status, priority, SLA and assignee lived only further down (status
 * and priority as Selects in an untitled card), so an agent scrolled to learn
 * what state the ticket was in.
 *
 * Read-only facts, each a `dt`/`dd` pair. Deliberately **no `aria-label` and
 * no `<label>`** anywhere here: the inspector's Selects are found by their
 * labels ("Status", "Priority" — Playwright's `getByLabel` matches by
 * substring), and a second labelled element would make that ambiguous. The
 * editable fields stay in the inspector; actions are RD-3.2.
 *
 * Sticky from `lg` on the canvas background, so the state stays in view while
 * the agent works down the conversation. Channel is not shown: tickets carry
 * no channel field (schema or API) — deferred, no backend change.
 *
 * Story 219 (PR-3.4) — the status spine (visual-direction.md §3) runs along
 * the header's top edge in the status hue, as on the board's columns. And
 * the realtime change cues (RD-3.13, recon TW-15): when a refetch shows the
 * status, priority or assignee changed by someone else, that field pulses
 * once (the board's cue; a static ring with reduced motion) and a polite
 * announcement says what changed. The agent's own edits (`isOwnChange`) are
 * neither cued nor announced.
 */
export type TicketHeaderSla =
  { status: "loading" } | { status: "error" } | { status: "ready"; target: TicketSlaTarget | null };

export function TicketHeader({
  ticket,
  locale,
  sla,
  assigneeName,
  assigneePresence,
  onSubjectCommit,
  actions,
  isOwnChange = () => false,
  backHref,
  navigation,
}: {
  ticket: TicketSummary;
  locale: string;
  sla: TicketHeaderSla;
  /** Resolved from the users list; `null` when the ticket is unassigned. */
  assigneeName: string | null;
  assigneePresence?: AvatarPresence;
  /** The same `PATCH` the page has always used for the subject. */
  onSubjectCommit: (subject: string, options: { onError: () => void }) => void;
  /** Story 202 (RD-3.2) — the header's actions, at the end of the title row. */
  actions?: ReactNode;
  /** Story 219 — whether a field's latest change was the agent's own edit. */
  isOwnChange?: (field: TicketHeaderField) => boolean;
  /** Story 220 — back to the board/list view (and filters) it was opened from. */
  backHref?: string;
  /** Story 220 — previous/next ticket in that view's order. */
  navigation?: ReactNode;
}) {
  const t = useTranslations("tickets");
  const labels = useTicketLabels();

  // --- Change cues (Story 219, RD-3.13) -------------------------------------
  const seen = useRef({
    status: ticket.status,
    priority: ticket.priority,
    assignee: ticket.assignedToUserId,
  });
  const [cued, setCued] = useState<ReadonlySet<TicketHeaderField>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const previous = seen.current;
    const next = {
      status: ticket.status,
      priority: ticket.priority,
      assignee: ticket.assignedToUserId,
    };
    seen.current = next;
    const changed = (["status", "priority", "assignee"] as const).filter(
      (field) => previous[field] !== next[field] && !isOwnChange(field),
    );
    if (changed.length === 0) return;
    setCued(new Set(changed));
    setAnnouncement(
      changed
        .map((field) =>
          field === "status"
            ? t("detail.changeCue.status", { value: labels.status(ticket.status) })
            : field === "priority"
              ? t("detail.changeCue.priority", { value: labels.priority(ticket.priority) })
              : assigneeName
                ? t("detail.changeCue.assignee", { value: assigneeName })
                : t("detail.changeCue.unassigned"),
        )
        .join(" "),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the three fields only
  }, [ticket.status, ticket.priority, ticket.assignedToUserId]);
  useEffect(() => {
    if (cued.size === 0) return;
    const timer = window.setTimeout(() => setCued(new Set()), CUE_MS);
    return () => window.clearTimeout(timer);
  }, [cued]);

  // The subject edit below moved here verbatim from TicketDetailView
  // (Stories 42, 156 and 166) — same states, same keys, same focus restore.
  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  /** Story 156 — the subject is a heading until an agent chooses to edit it. */
  const [editingSubject, setEditingSubject] = useState(false);
  /** Story 166 — the `Input` unmounts on both keyboard exits (Escape, and
   * Enter via `blur()`), so without this focus lands on `document.body`.
   * Guarded on `document.body`: a blur caused by clicking another control has
   * already moved focus somewhere valid and must not be overridden. Mirrors
   * `ConfirmDialog`'s own hand-rolled capture-and-restore (Story 94) rather
   * than introducing a shared focus-management hook for four call sites. */
  const subjectEditTriggerRef = useRef<HTMLButtonElement>(null);
  /** Latches on the first entry into edit mode, so the effect's own initial
   * run — which also sees `editingSubject === false`, on a page where nothing
   * is focused yet — cannot steal focus on load. */
  const subjectWasEditingRef = useRef(false);

  useEffect(() => {
    if (editingSubject) {
      subjectWasEditingRef.current = true;
      return;
    }
    if (!subjectWasEditingRef.current) return;
    subjectWasEditingRef.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body) {
      subjectEditTriggerRef.current?.focus();
    }
  }, [editingSubject]);

  const shortId = ticket.id.slice(0, 8);

  return (
    <header
      className={cn(
        "flex flex-col gap-stack border-b border-t-[3px] border-b-rule-subtle bg-surface-sunk pb-stack pt-stack lg:sticky lg:top-0 lg:z-20",
        statusSpine(ticket.status).top,
      )}
    >
      {/* Story 189 — the shared BackLink: chevron flips in RTL, token focus ring. */}
      <div className="flex items-center justify-between gap-inline">
        <BackLink asChild>
          <Link href={backHref ?? `/${locale}/tickets`}>{t("detail.backToList")}</Link>
        </BackLink>
        {navigation}
      </div>

      {/* Story 202 — the title block and the actions share a row that wraps:
          on narrow screens the actions move under the title. */}
      <div className="flex flex-wrap items-start justify-between gap-inline">
        <div className="flex min-w-0 flex-col gap-tight">
          {/* `dir="ltr"` keeps the id's characters in order inside Arabic text;
            `self-start` keeps it at the reading start, not the far edge. */}
          <span className="self-start font-mono text-caption text-ink-subtle" dir="ltr">
            #{shortId}
          </span>
          {/* Story 156 — a real, visible page title.

            NAV-2 added an `sr-only` h1 because the subject was an
            always-editable `Input`, so the page had no visible heading at
            all — the right accessibility patch for a layout problem it
            could not fix. The page read as a form rather than a record, and
            its most important text was the one thing not rendered as text.

            The subject is still editable through the same `PATCH`, with the
            same blur-commit and the same revert-on-error; editing is now an
            explicit mode instead of the permanent state. The `h1` carries
            the title in both modes, so the document outline never depends
            on which mode is active. */}
          {editingSubject ? (
            <>
              <h1 className="sr-only">
                <bdi>{ticket.subject}</bdi>
              </h1>
              <Input
                autoFocus
                className="w-full max-w-xl text-title"
                // Batch 5 (UX audit) — controlled (not `defaultValue`) so a
                // rejected edit can be explicitly reverted, mirroring
                // `SlaPolicyRow`'s own blur-commit-with-revert-on-error pattern:
                // `subjectDraft` starts `null` and falls back to the server's
                // own value until the field is actually touched.
                value={subjectDraft ?? ticket.subject}
                aria-label={t("detail.subjectLabel")}
                onChange={(event) => setSubjectDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Escape abandons the edit; the draft resets so reopening
                  // starts from the server's value, never a stale keystroke.
                  if (event.key === "Escape") {
                    setSubjectDraft(ticket.subject);
                    setEditingSubject(false);
                  }
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  const value = subjectDraft?.trim();
                  if (value && subjectDraft !== ticket.subject) {
                    onSubjectCommit(value, { onError: () => setSubjectDraft(ticket.subject) });
                  }
                  setEditingSubject(false);
                }}
              />
            </>
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-title text-ink">
                <bdi>{ticket.subject}</bdi>
              </h1>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                ref={subjectEditTriggerRef}
                onClick={() => setEditingSubject(true)}
              >
                {t("detail.subjectEdit")}
              </Button>
            </div>
          )}
        </div>
        {actions}
      </div>

      <dl className="flex flex-wrap gap-x-section gap-y-stack">
        <DescriptionItem term={t("list.columns.status")}>
          <span
            data-changed={cued.has("status") || undefined}
            className={cn("inline-flex", cued.has("status") && CUE_CLASS)}
          >
            <TicketStatusBadge status={ticket.status} />
          </span>
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.priority")}>
          <span
            data-changed={cued.has("priority") || undefined}
            className={cn("inline-flex", cued.has("priority") && CUE_CLASS)}
          >
            <TicketPriorityBadge priority={ticket.priority} />
          </span>
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.sla")}>
          {sla.status === "loading" && <Skeleton className="h-5 w-24" />}
          {sla.status === "error" && <span className="text-ink-subtle">—</span>}
          {sla.status === "ready" && (
            <SlaIndicator
              target={sla.target}
              createdAt={ticket.createdAt}
              ticketStatus={ticket.status}
            />
          )}
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.assignedAgent")}>
          {assigneeName ? (
            <span
              data-changed={cued.has("assignee") || undefined}
              className={cn("flex min-w-0 items-center gap-2", cued.has("assignee") && CUE_CLASS)}
            >
              <Avatar name={assigneeName} size="sm" presence={assigneePresence} decorative />
              <span className="max-w-48 truncate">{assigneeName}</span>
            </span>
          ) : (
            <span className="text-ink-subtle">{t("list.unassigned")}</span>
          )}
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.customer")}>
          <Link
            href={`/${locale}/customers/${ticket.customerId}`}
            className="focus-ring rounded-inner hover:underline"
          >
            {/* Story S-8d — resolved by the API. */}
            {ticket.customerName ?? ticket.customerId}
          </Link>
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.createdAt")} className="hidden lg:flex">
          <time dateTime={ticket.createdAt}>{formatDateTime(ticket.createdAt, locale)}</time>
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.updatedAt")} className="hidden lg:flex">
          <time dateTime={ticket.updatedAt}>{formatDateTime(ticket.updatedAt, locale)}</time>
        </DescriptionItem>
      </dl>
      {/* Always mounted, so the first change lands in an existing region. */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </header>
  );
}

/**
 * Story 202 (RD-3.2, recon TW-01) — the two things an agent most often does
 * to a ticket: take it, and resolve it (or close/reopen it). Callbacks only:
 * the view wires them to the very same handlers its inspector fields use,
 * so a header action sends exactly the request, toast and error handling of
 * the equivalent field. Disabled while that shared mutation is pending.
 *
 * The group's accessible name is "Ticket actions" — never "Status"/
 * "Priority", which the inspector's own fields are found by.
 */
export function TicketHeaderActions({
  status,
  canAssignToMe,
  pending,
  onAssignToMe,
  onSetStatus,
}: {
  status: TicketStatus;
  /** The current agent is known and is not already the assignee. */
  canAssignToMe: boolean;
  pending: boolean;
  onAssignToMe: () => void;
  onSetStatus: (status: TicketStatus) => void;
}) {
  const t = useTranslations("tickets");
  const open = status === "OPEN" || status === "IN_PROGRESS";
  // Demo hardening — resolving or closing notifies the customer, so the
  // header asks first, with the board's own confirmation copy (PD-5).
  // Reopening does not notify and stays one click.
  const [confirming, setConfirming] = useState<"RESOLVED" | "CLOSED" | null>(null);
  return (
    <div
      role="group"
      aria-label={t("detail.actions.label")}
      className="flex shrink-0 flex-wrap items-center gap-inline"
    >
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next) setConfirming(null);
        }}
        title={confirming ? t(`board.confirm.${confirming}.question`) : ""}
        description={t("board.confirm.notified")}
        confirmLabel={confirming ? t(`board.confirm.${confirming}.action`) : ""}
        destructive={false}
        isPending={pending}
        onConfirm={() => {
          if (confirming) onSetStatus(confirming);
          setConfirming(null);
        }}
      />
      {canAssignToMe && (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onAssignToMe}>
          {t("detail.actions.assignToMe")}
        </Button>
      )}
      {open && (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming("RESOLVED")}
        >
          {t("detail.actions.resolve")}
        </Button>
      )}
      {status === "RESOLVED" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming("CLOSED")}
        >
          {t("detail.actions.close")}
        </Button>
      )}
      {!open && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => onSetStatus("OPEN")}
        >
          {t("detail.actions.reopen")}
        </Button>
      )}
    </div>
  );
}
