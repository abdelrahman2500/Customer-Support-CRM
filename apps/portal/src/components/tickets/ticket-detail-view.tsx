"use client";

import { useState, type FormEvent } from "react";
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
import type { PortalTicketStatus } from "@/lib/tickets-api";
import { Badge, Button, Skeleton } from "@crm/ui";

const CSAT_ELIGIBLE_STATUSES: PortalTicketStatus[] = ["RESOLVED", "CLOSED"];

/**
 * Story S-2 — maps a ticket status onto one of `@crm/ui`'s semantic `Badge`
 * variants, replacing the hand-rolled pill class string this file and
 * `ticket-list-view.tsx` each carried a copy of.
 *
 * The mapping stays in this app on purpose: `@crm/ui` holds primitives and
 * knows nothing about tickets, so `TicketStatus -> variant` is domain
 * knowledge that belongs to a consumer. Each variant resolves to exactly the
 * colours the pill used before (warning = amber tint, success = emerald,
 * secondary = slate, outline = bordered), so the rendered result is
 * unchanged apart from Badge's slightly wider padding and medium weight —
 * which is what makes it identical to the agent workspace's own badges.
 */
function statusBadgeVariant(status: string): "warning" | "success" | "outline" | "secondary" {
  if (status === "OPEN") return "warning";
  if (status === "RESOLVED") return "success";
  if (status === "CLOSED") return "outline";
  return "secondary"; // IN_PROGRESS
}

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

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <Skeleton className="h-6 w-1/2" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton className="h-40 w-full" />

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-24 w-full" />
      </div>
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
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {notFound ? t("detail.notFound") : t("detail.loadError")}
      </div>
    );
  }

  const ticket = ticketQuery.data;
  if (!ticket) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <a
        href={`/${locale}/tickets`}
        className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
      >
        {/* `rtl:rotate-180` so "back" points the way back in both
            directions — a bare `&larr;` points *forward* in Arabic.
            `aria-hidden`: the adjacent label already names the action. */}
        <span aria-hidden="true" className="inline-block rtl:rotate-180">
          &larr;
        </span>{" "}
        {t("detail.backToList")}
      </a>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">{ticket.subject}</h1>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">{t("detail.status")}</dt>
            <dd>
              <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("detail.priority")}</dt>
            <dd className="font-medium text-slate-800">{ticket.priority}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("detail.category")}</dt>
            <dd className="font-medium text-slate-800">
              {ticket.categoryName ?? t("list.noCategory")}
            </dd>
          </div>
        </dl>
      </div>

      <TicketChatCard ticketId={ticketId} />

      <TicketAttachmentsCard ticketId={ticketId} />

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.historyHeading")}</h2>
        {historyQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {historyQuery.isError && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t("detail.historyError")}
          </div>
        )}
        {historyQuery.isSuccess && historyQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.historyEmpty")}</p>
        )}
        {historyQuery.isSuccess && historyQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {historyQuery.data.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between border-b border-slate-100 pb-2"
              >
                <span className="font-medium text-slate-800">{entry.eventType}</span>
                <span className="text-slate-500">
                  {new Date(entry.createdAt).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

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
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.csatHeading")}</h2>

      {csatQuery.isLoading && <Skeleton className="mt-2 h-16 w-full" />}

      {csatQuery.isError && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("detail.csatError")}
        </div>
      )}

      {csatQuery.isSuccess && csatQuery.data && (
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">
            {t("detail.csatRatingLabel", { rating: csatQuery.data.rating })}
          </span>
          {csatQuery.data.comment && <p className="text-slate-600">{csatQuery.data.comment}</p>}
          <p className="text-slate-500">{t("detail.csatSubmitted")}</p>
        </div>
      )}

      {csatQuery.isSuccess && !csatQuery.data && <CsatForm ticketId={ticketId} />}
    </div>
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
      <p className="text-sm text-slate-700">{t("detail.csatPrompt")}</p>
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
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {t("detail.csatCommentLabel")}
        <textarea
          className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus-ring"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
        />
      </label>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending || !rating} className="w-fit">
        {mutation.isPending ? t("detail.csatSubmitting") : t("detail.csatSubmit")}
      </Button>
    </form>
  );
}
