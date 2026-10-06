"use client";

import Link from "next/link";
import { ticketStatusPresentation } from "@crm/shared";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import type { PortalTicketSummary } from "@/lib/tickets-api";
import { cn, formatDate, toneSpine } from "@crm/ui";

/**
 * Story 229/230 (PR-5.1/5.2) — a ticket as a customer sees it in a list:
 * its subject, status, date and category, with the status spine agents see
 * on the board along its inline-start edge. The whole card is the link.
 * Shared by the home page and My Tickets.
 */
export function TicketCard({ ticket, locale }: { ticket: PortalTicketSummary; locale: string }) {
  const spine = toneSpine(ticketStatusPresentation(ticket.status).tone);
  return (
    <Link
      href={`/${locale}/tickets/${ticket.id}`}
      className={cn(
        "focus-ring flex flex-col gap-1.5 rounded-control border border-s-[3px] border-rule-subtle bg-surface px-3 py-2.5 hover:bg-surface-muted",
        spine.start,
      )}
    >
      {/* `break-words`: a subject is free text the customer typed, and one
          long unbreakable word must wrap rather than widen the card. */}
      <span className="min-w-0 break-words font-medium text-ink-strong">
        <bdi>{ticket.subject}</bdi>
      </span>
      <span className="flex flex-wrap items-center gap-2 text-caption text-ink-subtle">
        <TicketStatusBadge status={ticket.status} />
        <span>{formatDate(ticket.createdAt, locale)}</span>
        {ticket.categoryName && <span>· {ticket.categoryName}</span>}
      </span>
    </Link>
  );
}
