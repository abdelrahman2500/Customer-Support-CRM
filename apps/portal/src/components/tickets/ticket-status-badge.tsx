"use client";

import { useTranslations } from "next-intl";
import {
  ticketStatusPresentation,
  type PresentationTone,
  type TicketPresentationIcon,
} from "@crm/shared";
import {
  Badge,
  StatusClosedIcon,
  StatusInProgressIcon,
  StatusOpenIcon,
  StatusResolvedIcon,
  type BadgeProps,
  type LucideIcon,
} from "@crm/ui";

/**
 * Story 191 (RD-1.14) — a ticket status as the customer sees it: tone + icon
 * + localized label. Tone and icon come from `@crm/shared`'s
 * `ticket-presentation.ts`, the same data the agent workspace reads, so the
 * two apps can't drift; the label from the portal's own `tickets.status.*`
 * keys. Replaces `lib/ticket-badges.ts`. The portal shows no priority badge
 * (its priority labels are RD-1.16).
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
  "status-open": StatusOpenIcon,
  "status-in-progress": StatusInProgressIcon,
  "status-resolved": StatusResolvedIcon,
  "status-closed": StatusClosedIcon,
};

export function TicketStatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("tickets");
  const { tone, icon } = ticketStatusPresentation(status);
  return (
    <Badge variant={TONE_VARIANT[tone]} icon={ICON[icon]} className={className}>
      {t(`status.${status}` as Parameters<typeof t>[0])}
    </Badge>
  );
}
