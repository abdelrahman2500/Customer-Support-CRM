"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMyTicketCsatQuery,
  useMyTicketHistoryQuery,
  useMyTicketQuery,
  useSubmitMyTicketCsatMutation,
} from "@/hooks/use-portal-tickets";
import { usePortalTicketRealtime } from "@/hooks/use-portal-ticket-realtime";
import { TicketChatCard } from "@/components/tickets/ticket-chat-card";
import { TicketAttachmentsCard } from "@/components/tickets/ticket-attachments-card";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import type { PortalTicketStatus } from "@/lib/tickets-api";
import { Alert, Badge, Button, Card, PageHeader, Skeleton, Textarea } from "@crm/ui";

const CSAT_ELIGIBLE_STATUSES: PortalTicketStatus[] = ["RESOLVED", "CLOSED"];

/**
 * Story 53 — mirrors `apps/web`'s `TicketDetailView`'s loading/not-found/
 * generic-error convention and its History card's exact shape, read-only
 * (a portal Contact never edits a ticket — that's agent-only).
 *
 * Story 78 — a new "Live Chat" card (`TicketChatCard`), placed right after
 * the ticket summary header: unlike History/CSAT below it, chat is a
 * primary, frequently-used interaction surface. `usePortalTicketRealtime` is
 * this app's first realtime subscription — joins `ticket:{id}` exactly like
 * `apps/web`'s own `useTicketRealtime`, mirroring that hook's mount-once
 * placement here at the top of the view.
 */
/**
 * Story 97 — Loading & Skeleton UX. Replaces the previous generic
 * two-block skeleton with one shaped to match the real layout: the header
 * card's 3-field grid, the chat card, and the history card. Exported so
 * `app/[locale]/(customer)/tickets/[id]/loading.tsx` can render the
 * identical shape during the route transition itself.
 */
export function TicketDetailSkeleton() {
  return (
    <section className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-4 w-32" />

      <Card className="p-surface">
        <Skeleton className="h-6 w-1/2" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>

      <Skeleton className="h-40 w-full" />

      <Card className="p-surface">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-24 w-full" />
      </Card>
    </section>
  );
}

export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  usePortalTicketRealtime(ticketId);
  const ticketQuery = useMyTicketQuery(ticketId);
  const historyQuery = useMyTicketHistoryQuery(ticketId);

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

  return (
    <section className="flex flex-col gap-6">
      <Link
        href={`/${locale}/tickets`}
        className="text-sm font-medium text-ink-muted hover:text-ink hover:underline"
      >
        {/* `rtl:rotate-180` so "back" points the way back in both
            directions — a bare `&larr;` points *forward* in Arabic.
            `aria-hidden`: the adjacent label already names the action. */}
        <span aria-hidden="true" className="inline-block rtl:rotate-180">
          &larr;
        </span>{" "}
        {t("detail.backToList")}
      </Link>

      <Card className="p-surface">
        <PageHeader title={ticket.subject} />
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-subtle">{t("detail.status")}</dt>
            <dd>
              <Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">{t("detail.priority")}</dt>
            <dd className="font-medium text-ink-strong">{ticket.priority}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">{t("detail.category")}</dt>
            <dd className="font-medium text-ink-strong">
              {ticket.categoryName ?? t("list.noCategory")}
            </dd>
          </div>
        </dl>
      </Card>

      <TicketChatCard ticketId={ticketId} />

      <TicketAttachmentsCard ticketId={ticketId} />

      <Card className="p-surface">
        <h2 className="text-sm font-semibold text-ink">{t("detail.historyHeading")}</h2>
        {historyQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {historyQuery.isError && (
          <Alert variant="destructive" className="mt-2">
            {t("detail.historyError")}
          </Alert>
        )}
        {historyQuery.isSuccess && historyQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-ink-subtle">{t("detail.historyEmpty")}</p>
        )}
        {historyQuery.isSuccess && historyQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {historyQuery.data.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between border-b border-rule-subtle pb-2"
              >
                <span className="font-medium text-ink-strong">{entry.eventType}</span>
                <span className="text-ink-subtle">
                  {new Date(entry.createdAt).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {CSAT_ELIGIBLE_STATUSES.includes(ticket.status) && <CsatSection ticketId={ticketId} />}
    </section>
  );
}

/**
 * Story 55 — only rendered once the ticket is `RESOLVED`/`CLOSED` (mirrors
 * the backend's own status gate). Shows a read-only summary once a response
 * exists, otherwise a rating+comment submit form — never both at once.
 */
function CsatSection({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const csatQuery = useMyTicketCsatQuery(ticketId);

  return (
    <Card className="p-surface">
      <h2 className="text-sm font-semibold text-ink">{t("detail.csatHeading")}</h2>

      {csatQuery.isLoading && <Skeleton className="mt-2 h-16 w-full" />}

      {csatQuery.isError && (
        <Alert variant="destructive" className="mt-2">
          {t("detail.csatError")}
        </Alert>
      )}

      {csatQuery.isSuccess && csatQuery.data && (
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-strong">
            {t("detail.csatRatingLabel", { rating: csatQuery.data.rating })}
          </span>
          {csatQuery.data.comment && <p className="text-ink-muted">{csatQuery.data.comment}</p>}
          <p className="text-ink-subtle">{t("detail.csatSubmitted")}</p>
        </div>
      )}

      {csatQuery.isSuccess && csatQuery.data == null && <CsatForm ticketId={ticketId} />}
    </Card>
  );
}

function CsatForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useSubmitMyTicketCsatMutation(ticketId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!rating) {
      return;
    }
    try {
      await mutation.mutateAsync({
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.csatSubmitFailed"),
        }),
      );
    }
  }

  return (
    <form className="mt-2 flex flex-col gap-3" onSubmit={handleSubmit}>
      <p className="text-sm text-ink-strong">{t("detail.csatPrompt")}</p>
      <div role="radiogroup" aria-label={t("detail.csatRatingSelectLabel")} className="flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            onClick={() => setRating(value)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium focus-ring ${
              rating === value
                ? "border-accent bg-accent text-accent-foreground"
                : "border-rule-strong bg-surface text-ink-strong hover:bg-surface-sunk"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm text-ink-strong">
        {t("detail.csatCommentLabel")}
        <Textarea
          className="max-w-md"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
        />
      </label>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Button type="submit" disabled={mutation.isPending || !rating} className="w-fit">
        {mutation.isPending ? t("detail.csatSubmitting") : t("detail.csatSubmit")}
      </Button>
    </form>
  );
}
