"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Avatar,
  BackLink,
  Button,
  DescriptionItem,
  Input,
  Skeleton,
  formatDateTime,
  type AvatarPresence,
} from "@crm/ui";
import type { TicketSlaTarget } from "@/lib/sla";
import type { TicketSummary } from "@/lib/tickets-api";
import { SlaIndicator } from "./sla-indicator";
import { TicketPriorityBadge, TicketStatusBadge } from "./ticket-badges";

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
}: {
  ticket: TicketSummary;
  locale: string;
  sla: TicketHeaderSla;
  /** Resolved from the users list; `null` when the ticket is unassigned. */
  assigneeName: string | null;
  assigneePresence?: AvatarPresence;
  /** The same `PATCH` the page has always used for the subject. */
  onSubjectCommit: (subject: string, options: { onError: () => void }) => void;
}) {
  const t = useTranslations("tickets");

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
    <header className="flex flex-col gap-stack border-b border-rule-subtle bg-surface-sunk pb-stack lg:sticky lg:top-0 lg:z-20 lg:pt-stack">
      {/* Story 189 — the shared BackLink: chevron flips in RTL, token focus ring. */}
      <BackLink asChild>
        <Link href={`/${locale}/tickets`}>{t("detail.backToList")}</Link>
      </BackLink>

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
            <h1 className="sr-only">{ticket.subject}</h1>
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
            <h1 className="min-w-0 break-words text-title text-ink">{ticket.subject}</h1>
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

      <dl className="flex flex-wrap gap-x-section gap-y-stack">
        <DescriptionItem term={t("list.columns.status")}>
          <TicketStatusBadge status={ticket.status} />
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.priority")}>
          <TicketPriorityBadge priority={ticket.priority} />
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.sla")}>
          {sla.status === "loading" && <Skeleton className="h-5 w-24" />}
          {sla.status === "error" && <span className="text-ink-subtle">—</span>}
          {sla.status === "ready" && (
            <SlaIndicator target={sla.target} createdAt={ticket.createdAt} />
          )}
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.assignedAgent")}>
          {assigneeName ? (
            <span className="flex min-w-0 items-center gap-2">
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
        <DescriptionItem term={t("list.columns.createdAt")}>
          <time dateTime={ticket.createdAt}>{formatDateTime(ticket.createdAt, locale)}</time>
        </DescriptionItem>
        <DescriptionItem term={t("list.columns.updatedAt")}>
          <time dateTime={ticket.updatedAt}>{formatDateTime(ticket.updatedAt, locale)}</time>
        </DescriptionItem>
      </dl>
    </header>
  );
}
