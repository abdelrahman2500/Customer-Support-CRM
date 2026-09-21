"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateMyTicketMutation, useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import type { PortalTicketStatus } from "@/lib/tickets-api";
import {
  Alert,
  Badge,
  Button,
  Card,
  FetchingIndicator,
  FilterBar,
  FilterSelect,
  FormField,
  Input,
  PageHeader,
  Pagination,
  showSuccessToast,
  Skeleton,
} from "@crm/ui";

/** Story 148 — the four statuses a customer can filter by, in the order
 * a ticket actually moves through them. `TicketStatus` has exactly these
 * four (`apps/api/prisma/schema.prisma`). */
const STATUSES: readonly PortalTicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

/** Radix `Select` cannot represent an empty-string option value, which is
 * why `FilterSelect` takes a caller-supplied sentinel — see its own doc
 * comment. */
const ALL_STATUSES = "ALL";

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
 * `FetchingIndicator` usage exactly (Story S-8c).
 *
 * Story 148 — Portal Ticket Search & Filtering. Closes the gap the comment
 * that used to sit here disclosed ("No filtering/search/sort is added").
 *
 * Two controls, not the agent list's seven. A customer asks "where's the
 * one about the printer?" and "what's still open?"; they never ask about an
 * assignee, a department or a triage priority, and the portal deliberately
 * shows none of those. Search follows this app's own established pattern
 * exactly — `ArticleListView`'s un-debounced input, with typing resetting to
 * page 1 in the same update — rather than importing the agent workspace's.
 *
 * `FilterBar`/`FilterSelect` are shared primitives, not the agent screen's
 * composition: `FilterBar` is the encoded responsive rule (stacked and
 * full-width below `sm`, inline above), which is precisely what a
 * hand-rolled row here would get wrong. `FormField`'s compact density
 * renders a label identical to `FilterSelect`'s own, so the search box and
 * the status dropdown align as one control strip instead of two
 * differently-labelled controls in a row.
 *
 * Status labels are translated here for the first time (`status.*`). The
 * list previously rendered the raw enum — a customer reading "IN_PROGRESS",
 * in Arabic as well as English. A filter offering "In progress" beside rows
 * saying "IN_PROGRESS" would not have been coherent, so the badge and the
 * filter now read from the same keys.
 */
export function TicketListView() {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PortalTicketStatus | typeof ALL_STATUSES>(ALL_STATUSES);
  /** 1-based; `undefined` until the reader pages. */
  const [page, setPage] = useState<number | undefined>(undefined);

  /** Changing a filter resets to page 1 in the same update as the filter
   * itself, so no request is ever made for "page 7 of the new filter" —
   * `ArticleListView`'s own rule, which this list previously had no
   * filters to need. */
  function updateSearch(value: string) {
    setSearch(value);
    setPage(undefined);
  }

  function updateStatus(value: string) {
    setStatus(value as PortalTicketStatus | typeof ALL_STATUSES);
    setPage(undefined);
  }

  function clearFilters() {
    setSearch("");
    setStatus(ALL_STATUSES);
    setPage(undefined);
  }

  const hasActiveFilters = search !== "" || status !== ALL_STATUSES;

  const ticketsQuery = useMyTicketsQuery({
    page,
    ...(search ? { search } : {}),
    ...(status !== ALL_STATUSES ? { status } : {}),
  });
  const ticketPage = ticketsQuery.data;
  const tickets = ticketPage?.items;

  return (
    <section className="flex flex-col gap-6">
      {/* Story 98 — p-4, not p-6: matches apps/web's own dominant card
          padding convention (see that app's data cards throughout). */}
      <Card className="p-surface">
        <div className="flex items-center justify-between gap-3">
          <PageHeader title={t("list.title")} />
          {/* In the heading's own row, so it adds no height and cannot
              shift the list below it — mirrors ArticleListView exactly. */}
          <FetchingIndicator active={ticketsQuery.isPlaceholderData} label={tCommon("updating")} />
        </div>

        <FilterBar className="mt-3">
          {/* `FormField` compact renders the same `text-xs text-ink-muted`
              label `FilterSelect` does, so the two controls share a
              baseline instead of one carrying a visible label and the
              other only an `aria-label`. */}
          <FormField label={t("list.searchLabel")} className="sm:w-64">
            <Input
              type="search"
              placeholder={t("list.searchPlaceholder")}
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
            />
          </FormField>
          <FilterSelect
            label={t("list.filterStatus")}
            value={status}
            onChange={updateStatus}
            options={STATUSES}
            allValue={ALL_STATUSES}
            allLabel={t("list.filterAll")}
            renderLabel={(value) => t(`status.${value}` as Parameters<typeof t>[0])}
          />
        </FilterBar>

        {/* The active-filter state: how many tickets the current filters
            match, and the one control that undoes them. Rendered only when
            something is actually filtered, so an untouched list is exactly
            as quiet as it was before this story. */}
        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
            <span role="status">
              {ticketPage === undefined
                ? tCommon("updating")
                : t("list.resultCount", { count: ticketPage.total })}
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t("list.clearFilters")}
            </Button>
          </div>
        )}

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

        {/* Story 148 — "you have no tickets" and "nothing matched what you
            asked for" are different facts, and telling a customer who has
            twenty tickets that they have none is the version of this the
            list used to show. Mirrors `ArticleListView`'s own split. */}
        {tickets !== undefined && tickets.length === 0 && !hasActiveFilters && (
          <p className="mt-3 text-sm text-ink-subtle">{t("list.empty")}</p>
        )}

        {/* No second "clear" control here: the active-filter row above is
            always on screen whenever this message is, and two buttons with
            the same label a few pixels apart is worse than one. */}
        {tickets !== undefined && tickets.length === 0 && hasActiveFilters && (
          <p className="mt-3 text-sm text-ink-subtle">{t("list.noResults")}</p>
        )}

        {tickets !== undefined && tickets.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex cursor-pointer items-center justify-between gap-2 border-b border-rule-subtle pb-2"
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
              >
                {/* `min-w-0 break-words` for the same reason
                    `ArticleListView`'s title carries it: a subject is
                    customer-written free text, and a flex item's default
                    `min-width: auto` refuses to shrink below it, pushing
                    the status and date past the viewport edge on a narrow
                    screen. The status/date group keeps `shrink-0` so it is
                    never squeezed instead. */}
                <Link
                  href={`/${locale}/tickets/${ticket.id}`}
                  className="focus-ring min-w-0 break-words rounded-sm font-medium text-ink-strong hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {ticket.subject}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-ink-subtle">
                  <Badge variant={ticketStatusBadgeVariant(ticket.status)}>
                    {t(`status.${ticket.status}` as Parameters<typeof t>[0])}
                  </Badge>
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
      </Card>

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
    <Card className="p-surface">
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
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button type="submit" disabled={mutation.isPending || !subject.trim()} className="w-fit">
          {mutation.isPending ? t("list.createSubmitting") : t("list.createSubmit")}
        </Button>
      </form>
    </Card>
  );
}
