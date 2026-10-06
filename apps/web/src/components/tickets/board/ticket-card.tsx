"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ticketPriorityPresentation } from "@crm/shared";
import { Avatar, cn, formatDateTime, formatRelative, recipes } from "@crm/ui";
import type { TicketListItem } from "@/lib/tickets-api";
import { deriveSlaStatus } from "@/lib/sla";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import { SlaIndicator } from "@/components/tickets/sla-indicator";
import { TICKET_ICON, TicketPriorityBadge } from "@/components/tickets/ticket-badges";

/**
 * Story 216 (PR-3.1, tickets-kanban-ux.md §4) — one ticket on the board.
 *
 * - The subject is the card's link (stretched over the whole card), so the
 *   card opens on click or Enter; the card's other controls (the menu and
 *   drag handle, PR-3.2) sit above it in `actions` and never nest inside the
 *   link. Its description names status, priority, assignee and SLA, so a
 *   screen-reader user hears the facts without reading every chip.
 * - Urgency is rare on purpose: HIGH/URGENT get a 3px inline-start edge in
 *   their tone and a badge; LOW/MEDIUM show only a labelled icon.
 * - SLA shows only when it matters (at risk, breached, on hold).
 */
export function TicketCard({
  ticket,
  locale,
  assigneeName,
  href,
  actions,
  now,
  className,
}: {
  ticket: TicketListItem;
  locale: string;
  /** Resolved from the loaded users; `null` when unassigned. */
  assigneeName: string | null;
  /** Story 220 — the link, with the board's context for prev/next. */
  href?: string;
  actions?: ReactNode;
  now?: Date;
  className?: string;
}) {
  const t = useTranslations("tickets.board");
  const labels = useTicketLabels();
  const descriptionId = useId();
  const priority = ticketPriorityPresentation(ticket.priority);
  const urgent = priority.tone === "warning" || priority.tone === "danger";
  const sla = deriveSlaStatus(ticket.slaTarget, now, { createdAt: ticket.createdAt });
  // SLA is about work still to do: done tickets (resolved, closed) never
  // show it, and active ones only when it matters.
  const active = ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";
  const showSla =
    active &&
    (sla.kind === "breached" || sla.kind === "on-hold" || (sla.kind === "on-track" && sla.atRisk));
  const PriorityIcon = TICKET_ICON[priority.icon];
  const assignee = assigneeName ?? t("unassigned");

  return (
    <article
      className={cn(
        recipes.card,
        recipes.liftable,
        "relative flex flex-col gap-2 p-3 text-body-sm focus-within:border-rule-strong",
        urgent && "border-s-[3px]",
        priority.tone === "danger" && "border-s-danger-solid",
        priority.tone === "warning" && "border-s-warning-solid",
        className,
      )}
    >
      <div className="flex items-center gap-tight text-caption text-ink-subtle">
        <span className="font-mono" dir="ltr">
          #{ticket.id.slice(0, 8)}
        </span>
        {ticket.categoryName && (
          <>
            <span aria-hidden="true">·</span>
            <span className="min-w-0 truncate">{ticket.categoryName}</span>
          </>
        )}
        {actions && <span className="relative z-10 ms-auto flex items-center">{actions}</span>}
      </div>

      <Link
        href={href ?? `/${locale}/tickets/${ticket.id}`}
        aria-describedby={descriptionId}
        title={ticket.subject}
        className="focus-ring line-clamp-2 rounded-inner font-medium text-ink-strong after:absolute after:inset-0 after:rounded-surface after:content-[''] hover:text-ink"
      >
        <bdi>{ticket.subject}</bdi>
      </Link>

      <p className="min-w-0 truncate text-caption text-ink-muted">
        {ticket.customerName ?? ticket.customerId}
      </p>

      <div className="flex flex-wrap items-center gap-tight">
        {urgent ? (
          <TicketPriorityBadge priority={ticket.priority} className="text-caption" />
        ) : (
          // Demo hardening — low and medium priority read as a quiet label
          // (icon and word), not a lone glyph that looked like a rendering
          // glitch; only high and urgent get a coloured badge.
          <span className="inline-flex items-center gap-1 text-caption text-ink-subtle">
            <PriorityIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {labels.priority(ticket.priority)}
          </span>
        )}
        {showSla && (
          <SlaIndicator target={ticket.slaTarget} createdAt={ticket.createdAt} now={now} />
        )}
        <span className="ms-auto flex items-center gap-tight">
          <time
            dateTime={ticket.updatedAt}
            title={formatDateTime(ticket.updatedAt, locale)}
            className="text-caption tabular-nums text-ink-subtle"
          >
            {formatRelative(ticket.updatedAt, locale, now)}
          </time>
          <Avatar
            name={assignee}
            size="sm"
            variant={assigneeName ? "person" : "unassigned"}
            title={assignee}
          />
        </span>
      </div>

      <span id={descriptionId} className="sr-only">
        {t("cardDescription", {
          status: labels.status(ticket.status),
          priority: labels.priority(ticket.priority),
          assignee,
        })}
      </span>
    </article>
  );
}
