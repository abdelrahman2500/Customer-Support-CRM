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
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { historyEventKey } from "@/lib/history-event";
import type { PortalTicketStatus } from "@/lib/tickets-api";
import { ticketStatusPresentation } from "@crm/shared";
import {
  Alert,
  Button,
  Card,
  LoadingStatus,
  PageHeader,
  SectionCard,
  Skeleton,
  Textarea,
  cn,
  toneSpine,
} from "@crm/ui";
import { BackLink } from "@crm/ui";
import { ErrorState } from "@crm/ui";
import { formatDate, formatDateTime } from "@crm/ui";

const CSAT_ELIGIBLE_STATUSES: PortalTicketStatus[] = ["RESOLVED", "CLOSED"];

/** Story 167 — the shared `name` is what makes the browser treat the five
 * rating inputs as one radio group: one tab stop, arrow-key movement with
 * selection following focus, wrapping, and direction-correct arrows under
 * `dir="rtl"`. Nothing in this file implements any of that. */
const CSAT_RATING_NAME = "csat-rating";

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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-section lg:grid-cols-3 lg:items-start">
        <Skeleton className="h-64 w-full lg:col-span-2" />
        <Card className="p-surface">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-24 w-full" />
        </Card>
      </div>
    </section>
  );
}

export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  usePortalTicketRealtime(ticketId);
  const ticketQuery = useMyTicketQuery(ticketId);
  const historyQuery = useMyTicketHistoryQuery(ticketId);

  if (ticketQuery.isLoading) {
    return (
      <LoadingStatus label={tCommon("loading")} placeholderHidden={false}>
        <TicketDetailSkeleton />
      </LoadingStatus>
    );
  }

  if (ticketQuery.isError) {
    const notFound = ticketQuery.error instanceof ApiError && ticketQuery.error.status === 404;
    // Story 199 (RD-2.5, recon A11Y-03/VL-08) — a record that failed to load
    // is the page: an h1, a way back, and a retry when retrying can help (a
    // 404 will not come back on its own).
    return (
      <ErrorState
        headingLevel={1}
        tone={notFound ? "neutral" : "danger"}
        title={notFound ? t("detail.notFound") : t("detail.loadError")}
        actions={
          notFound ? undefined : (
            <Button onClick={() => void ticketQuery.refetch()}>
              {tCommon("errorBoundary.retry")}
            </Button>
          )
        }
        back={
          <BackLink asChild>
            <Link href={`/${locale}/tickets`}>{t("detail.backToList")}</Link>
          </BackLink>
        }
      />
    );
  }

  const ticket = ticketQuery.data;
  if (!ticket) {
    return null;
  }

  const spine = toneSpine(ticketStatusPresentation(ticket.status).tone);
  const feedbackDue = CSAT_ELIGIBLE_STATUSES.includes(ticket.status);

  return (
    <section className="flex flex-col gap-section">
      {/* Story 189 — the shared BackLink: chevron flips in RTL, token focus ring. */}
      <BackLink asChild>
        <Link href={`/${locale}/tickets`}>{t("detail.backToList")}</Link>
      </BackLink>

      {/* Story 230 (PR-5.2) — the header carries the status spine along
          its top edge, the same hue the customer's ticket cards and the
          agent's board use for this status. */}
      <Card className={cn("border-t-[3px] p-surface", spine.top)}>
        <PageHeader title={ticket.subject} />
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-subtle">{t("detail.status")}</dt>
            <dd>
              {/* Story 148 — the same `status.*` keys the list and its
                  status filter read from, so the three can never disagree
                  about what a status is called. */}
              <TicketStatusBadge status={ticket.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">{t("detail.priority")}</dt>
            <dd>
              <TicketPriorityBadge priority={ticket.priority} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">{t("detail.category")}</dt>
            <dd className="font-medium text-ink-strong">
              {ticket.categoryName ?? t("list.noCategory")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">{t("detail.opened")}</dt>
            <dd className="font-medium text-ink-strong">{formatDate(ticket.createdAt, locale)}</dd>
          </div>
        </dl>
      </Card>

      {/* Story 230 — a closed ticket says what to do next instead of
          leaving the customer at a conversation nobody is watching. */}
      {ticket.status === "CLOSED" && (
        <Alert variant="info" icon title={t("detail.closedTitle")}>
          {t("detail.closedBody")}{" "}
          <Link
            href={`/${locale}/tickets#new-ticket`}
            className="focus-ring rounded-sm font-medium underline"
          >
            {t("detail.closedAction")}
          </Link>
        </Alert>
      )}

      {/* Story 230 — feedback is asked for first, right under the header,
          once the ticket is resolved: it is the one thing left to do. */}
      {feedbackDue && <CsatSection ticketId={ticketId} />}

      <div className="grid gap-section lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <TicketChatCard ticketId={ticketId} />
        </div>

        <div className="flex flex-col gap-section">
          <TicketAttachmentsCard ticketId={ticketId} />

          <SectionCard title={t("detail.historyHeading")}>
            {historyQuery.isLoading && (
              <LoadingStatus label={tCommon("loading")} asChild>
                <Skeleton className="mt-2 h-24 w-full" />
              </LoadingStatus>
            )}
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
                    <span className="font-medium text-ink-strong">
                      {t(`detail.historyEvent.${historyEventKey(entry.eventType)}`)}
                    </span>
                    <span className="text-ink-subtle">
                      {formatDateTime(entry.createdAt, locale)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>
      </div>
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
  const tCommon = useTranslations("common");
  const csatQuery = useMyTicketCsatQuery(ticketId);

  // Story 230 — set apart with the accent edge: a resolved ticket's one
  // remaining action.
  return (
    <SectionCard title={t("detail.csatHeading")} className="border-s-[3px] border-s-accent">
      {csatQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} asChild>
          <Skeleton className="mt-2 h-16 w-full" />
        </LoadingStatus>
      )}

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
    </SectionCard>
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
      {/* Story 167 — native radios, so the browser supplies the ARIA radio
          group keyboard pattern the hand-built `role="radio"` buttons never
          had. Applies the decision `branding-view.tsx` already recorded
          (Story 129): a small radio group uses native inputs rather than a
          new shared primitive.

          The `<div role="radiogroup">` and its label are deliberately kept
          over a `<fieldset>`/`<legend>`: this group's name is invisible (the
          visible prompt is `csatPrompt` above), and radios group by their
          shared `name`, not by a fieldset, so the keyboard behaviour is the
          same either way. */}
      <div role="radiogroup" aria-label={t("detail.csatRatingSelectLabel")} className="flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <label key={value} className="cursor-pointer">
            {/* `sr-only`, never `hidden`/`display:none`: the input stays
                focusable and in the accessibility tree, and the visible box
                below is styled from it through `peer`. `.focus-ring` cannot
                be used here because the focused element is the input while
                the painted element is the span — these are that utility's own
                declarations, restated as `peer-focus-visible:` variants over
                the same tokens. */}
            <input
              type="radio"
              name={CSAT_RATING_NAME}
              value={value}
              checked={rating === value}
              onChange={() => setRating(value)}
              className="peer sr-only"
            />
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                rating === value
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-rule-strong bg-surface text-ink-strong hover:bg-surface-sunk"
              }`}
            >
              {value}
            </span>
          </label>
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
