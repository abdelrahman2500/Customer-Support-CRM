"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, ErrorIcon, WarningIcon, cn } from "@crm/ui";
import { deriveSlaStatus, splitDuration, type TicketSlaTarget } from "@/lib/sla";
import { formatDateTime } from "@crm/ui";

/**
 * Story 192 (RD-1.15) — the one way a ticket's SLA state is shown. Replaces
 * the ticket list's `SlaCell`, the dashboard's `SlaPresentation` and the
 * detail page's inline rendering, and adds what none of them said:
 *
 * - which target governs ("Response"/"Resolution");
 * - the at-risk tier (decision D3, presentation only — `lib/sla.ts`);
 * - a localized duration: unit words and locale digits from
 *   `common.duration.*`, so Arabic shows no Latin "h"/"m" (digits are
 *   whatever `Intl` gives the locale — decision D4 keeps that behaviour).
 *
 * Tones follow docs/architecture/13-design-language.md: on-track and on-hold
 * neutral, at-risk warning, breached danger. At-risk and breached carry an
 * icon, and at-risk a screen-reader prefix, so meaning is never colour-only.
 * No live countdown: `now` is a snapshot, as before.
 */
export function SlaIndicator({
  target,
  createdAt,
  now,
  variant = "compact",
  className,
}: {
  target: TicketSlaTarget | null;
  /** The ticket's creation time — the start of the D3 at-risk window. */
  createdAt?: string | Date;
  now?: Date;
  variant?: "compact" | "detail";
  className?: string;
}) {
  const t = useTranslations("tickets");
  const formatDuration = useFormatDuration();
  const { locale } = useParams<{ locale: string }>();
  const status = deriveSlaStatus(target, now, { createdAt });
  const detail = variant === "detail";

  if (status.kind === "none") {
    const Tag = detail ? "p" : "span";
    return (
      <Tag className={cn("text-ink-subtle", detail && "mt-1 text-sm", className)}>
        {t("sla.none")}
      </Tag>
    );
  }

  if (status.kind === "on-hold") {
    return (
      <Badge variant="secondary" className={cn(detail && "mt-2", className)}>
        {detail
          ? t("sla.onHoldSince", { time: formatDateTime(status.onHoldSince, locale) })
          : t("sla.onHold")}
      </Badge>
    );
  }

  const targetLabel = t(`sla.target.${status.governing}`);

  if (status.kind === "breached") {
    return (
      <Badge variant="destructive" icon={ErrorIcon} className={cn(detail && "mt-2", className)}>
        {detail
          ? t("sla.breachedTargetAt", {
              target: targetLabel,
              time: formatDateTime(status.targetAt, locale),
            })
          : t("sla.breachedTarget", { target: targetLabel })}
      </Badge>
    );
  }

  const dueIn = t("sla.dueIn", { target: targetLabel, time: formatDuration(status.remainingMs) });

  if (status.atRisk) {
    return (
      <Badge variant="warning" icon={WarningIcon} className={cn(detail && "mt-2", className)}>
        <span className="sr-only">{t("sla.atRisk")} </span>
        {dueIn}
      </Badge>
    );
  }

  const Tag = detail ? "p" : "span";
  return <Tag className={cn("text-ink-strong", detail && "mt-1 text-sm", className)}>{dueIn}</Tag>;
}

/** Formats a duration through `common.duration.*` (localized units and
 * digits). Under a minute reads as "<1m" / "أقل من دقيقة". */
function useFormatDuration() {
  const t = useTranslations("common.duration");
  return (ms: number) => {
    const parts = splitDuration(ms);
    if (!parts) {
      return t("lessThanMinute");
    }
    return parts.hours > 0
      ? t("hoursMinutes", { hours: parts.hours, minutes: parts.minutes })
      : t("minutes", { minutes: parts.minutes });
  };
}
