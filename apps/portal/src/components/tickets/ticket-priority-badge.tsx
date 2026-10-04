"use client";

import { useTranslations } from "next-intl";
import {
  ticketPriorityPresentation,
  type PresentationTone,
  type TicketPresentationIcon,
} from "@crm/shared";
import {
  Badge,
  PriorityHighIcon,
  PriorityLowIcon,
  PriorityMediumIcon,
  PriorityUrgentIcon,
  type BadgeProps,
  type LucideIcon,
} from "@crm/ui";

/**
 * Story 193 (RD-1.16) — a ticket's priority as the customer sees it, where
 * the detail page used to print the raw enum ("URGENT"). Tone and icon come
 * from `@crm/shared`'s `ticket-presentation.ts`, like `TicketStatusBadge`
 * (Story 191) and the agent workspace; the label from `tickets.priority.*`.
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

const ICON: Partial<Record<TicketPresentationIcon, LucideIcon>> = {
  "priority-low": PriorityLowIcon,
  "priority-medium": PriorityMediumIcon,
  "priority-high": PriorityHighIcon,
  "priority-urgent": PriorityUrgentIcon,
};

export function TicketPriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  const t = useTranslations("tickets");
  const { tone, icon } = ticketPriorityPresentation(priority);
  return (
    <Badge variant={TONE_VARIANT[tone]} icon={ICON[icon]} className={className}>
      {t(`priority.${priority}` as Parameters<typeof t>[0])}
    </Badge>
  );
}
