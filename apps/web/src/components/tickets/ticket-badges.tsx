"use client";

import {
  ticketPriorityPresentation,
  ticketStatusPresentation,
  type PresentationTone,
  type TicketPresentationIcon,
} from "@crm/shared";
import {
  Badge,
  PriorityHighIcon,
  PriorityLowIcon,
  PriorityMediumIcon,
  PriorityUrgentIcon,
  StatusClosedIcon,
  StatusInProgressIcon,
  StatusOpenIcon,
  StatusResolvedIcon,
  type BadgeProps,
  type LucideIcon,
} from "@crm/ui";
import { useTicketLabels } from "@/hooks/use-ticket-labels";

/**
 * Story 191 (RD-1.14) — the one way a ticket status or priority is shown in
 * the agent workspace: tone + icon + localized label. Tone and icon come
 * from `@crm/shared`'s `ticket-presentation.ts` (the same data the portal
 * reads); the label from `useTicketLabels`. Replaces `lib/ticket-badges.ts`,
 * whose amber OPEN/HIGH and grey IN_PROGRESS/LOW/MEDIUM collided.
 */
type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const TONE_VARIANT: Record<PresentationTone, BadgeVariant> = {
  neutral: "secondary",
  info: "info",
  progress: "progress",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

/** Story 216 — exported for the board (column headers, card priority icons). */
export const TICKET_ICON: Record<TicketPresentationIcon, LucideIcon> = {
  "status-open": StatusOpenIcon,
  "status-in-progress": StatusInProgressIcon,
  "status-resolved": StatusResolvedIcon,
  "status-closed": StatusClosedIcon,
  "priority-low": PriorityLowIcon,
  "priority-medium": PriorityMediumIcon,
  "priority-high": PriorityHighIcon,
  "priority-urgent": PriorityUrgentIcon,
};

export function TicketStatusBadge({ status, className }: { status: string; className?: string }) {
  const ticketLabels = useTicketLabels();
  const { tone, icon } = ticketStatusPresentation(status);
  return (
    <Badge variant={TONE_VARIANT[tone]} icon={TICKET_ICON[icon]} className={className}>
      {ticketLabels.status(status)}
    </Badge>
  );
}

/** Also serves `TaskPriority`, which has the same members. */
export function TicketPriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  const ticketLabels = useTicketLabels();
  const { tone, icon } = ticketPriorityPresentation(priority);
  return (
    <Badge variant={TONE_VARIANT[tone]} icon={TICKET_ICON[icon]} className={className}>
      {ticketLabels.priority(priority)}
    </Badge>
  );
}
