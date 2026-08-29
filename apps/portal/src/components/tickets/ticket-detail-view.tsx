"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMyTicketHistoryQuery, useMyTicketQuery } from "@/hooks/use-portal-tickets";
import { ApiError } from "@/lib/api";

/**
 * Story 53 — mirrors `apps/web`'s `TicketDetailView`'s loading/not-found/
 * generic-error convention and its History card's exact shape, read-only
 * (a portal Contact never edits a ticket — that's agent-only).
 */
export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  const ticketQuery = useMyTicketQuery(ticketId);
  const historyQuery = useMyTicketHistoryQuery(ticketId);

  if (ticketQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-100" />
        <div className="h-32 w-full animate-pulse rounded-md bg-slate-100" />
      </div>
    );
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
        &larr; {t("detail.backToList")}
      </a>

      <div className="rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">{ticket.subject}</h1>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">{t("detail.status")}</dt>
            <dd className="font-medium text-slate-800">{ticket.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("detail.priority")}</dt>
            <dd className="font-medium text-slate-800">{ticket.priority}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("detail.category")}</dt>
            <dd className="font-medium text-slate-800">
              {ticket.category ?? t("list.noCategory")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.historyHeading")}</h2>
        {historyQuery.isLoading && (
          <div className="mt-2 h-24 w-full animate-pulse rounded-md bg-slate-100" />
        )}
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
    </section>
  );
}
