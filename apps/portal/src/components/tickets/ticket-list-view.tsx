"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateMyTicketMutation, useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import {
  Alert,
  Badge,
  Button,
  FetchingIndicator,
  Input,
  Pagination,
  Skeleton,
  showSuccessToast,
} from "@crm/ui";

/**
 * Story 53 — Customer Portal — Submit & Track Own Tickets. Mirrors
 * `apps/web`'s established loading/error/empty/populated card shape and
 * `AddDepartmentForm`'s "smallest UI surface for a one-field(ish) create"
 * convention — plain HTML/Tailwind, no shared UI component library exists
 * in `apps/portal` (Story 52 precedent).
 *
 * PORTAL-1 — Portal My Tickets Pagination. `useMyTicketsQuery`'s response is
 * now a `Paginated<PortalTicketSummary>` envelope instead of a flat array,
 * mirroring the portal's own `ArticleListView`'s page state/`Pagination`/
 * `FetchingIndicator` usage exactly (Story S-8c). No filtering/search/sort
 * is added — this list has none of those, unlike the agent workspace's own
 * ticket list.
 */
export function TicketListView() {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  /** 1-based; `undefined` until the reader pages. */
  const [page, setPage] = useState<number | undefined>(undefined);
  const ticketsQuery = useMyTicketsQuery(page);
  const ticketPage = ticketsQuery.data;
  const tickets = ticketPage?.items;

  return (
    <section className="flex flex-col gap-6">
      {/* Story 98 — p-4, not p-6: matches apps/web's own dominant card
          padding convention (see that app's data cards throughout). */}
      <div className="rounded-md border border-rule bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-ink">{t("list.title")}</h1>
          {/* In the heading's own row, so it adds no height and cannot
              shift the list below it — mirrors ArticleListView exactly. */}
          <FetchingIndicator active={ticketsQuery.isPlaceholderData} label={tCommon("updating")} />
        </div>

        {ticketsQuery.isPending && (
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        )}

        {ticketsQuery.isError && (
          <Alert variant="destructive" className="mt-3 flex items-center justify-between">
            <span>{t("list.error")}</span>
            <Button variant="outline" size="sm" onClick={() => ticketsQuery.refetch()}>
              {t("list.retry")}
            </Button>
          </Alert>
        )}

        {tickets !== undefined && tickets.length === 0 && (
          <p className="mt-3 text-sm text-ink-subtle">{t("list.empty")}</p>
        )}

        {tickets !== undefined && tickets.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex cursor-pointer items-center justify-between border-b border-rule-subtle pb-2"
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
              >
                <Link
                  href={`/${locale}/tickets/${ticket.id}`}
                  className="focus-ring rounded-sm font-medium text-ink-strong hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {ticket.subject}
                </Link>
                <span className="flex items-center gap-2 text-ink-subtle">
                  <Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                  <span>{new Date(ticket.createdAt).toLocaleDateString(locale)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        {ticketPage !== undefined && (
          <div className="mt-3">
            {/* Story S-8c — the shared pager, same primitive the agent
                workspace and this portal's own KB list use. Renders nothing
                for a single page. */}
            <Pagination
              page={ticketPage.page}
              totalPages={ticketPage.totalPages}
              onPageChange={setPage}
              disabled={ticketsQuery.isPlaceholderData}
              label={tCommon("pagination.label")}
              previousLabel={tCommon("pagination.previous")}
              nextLabel={tCommon("pagination.next")}
              indicator={tCommon("pagination.indicator", {
                page: ticketPage.page,
                totalPages: ticketPage.totalPages,
              })}
            />
          </div>
        )}
      </div>

      <CreateTicketForm />
    </section>
  );
}

function CreateTicketForm() {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateMyTicketMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        subject: subject.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
      });
      setSubject("");
      setCategory("");
      showSuccessToast(t("list.createSuccess"));
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("list.actionForbidden"),
          generic: t("list.createFailed"),
        }),
      );
    }
  }

  return (
    <div className="rounded-md border border-rule bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">{t("list.createHeading")}</h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-ink-strong">
          {t("list.createSubjectLabel")}
          <Input
            className="max-w-md"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-strong">
          {t("list.createCategoryLabel")}
          <Input
            className="max-w-md"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        {error && (
          <Alert variant="destructive">
            {error}
          </Alert>
        )}
        <Button type="submit" disabled={mutation.isPending || !subject.trim()} className="w-fit">
          {mutation.isPending ? t("list.createSubmitting") : t("list.createSubmit")}
        </Button>
      </form>
    </div>
  );
}
