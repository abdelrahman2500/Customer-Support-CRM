"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { usePublishedArticlesQuery } from "@/hooks/use-portal-knowledge-base";
import { ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import type { KbLocale } from "@/lib/knowledge-base-api";
import { Alert, Badge, Button, Skeleton } from "@crm/ui";

/**
 * Story 136 — the Customer Portal's real landing page.
 *
 * Stories 52/53 left this route as a placeholder: one sentence (under a key
 * literally named `home.placeholder`) and one link. It is nonetheless the
 * canonical destination for every authenticated customer — `[locale]/page.tsx`
 * redirects here, `PortalHeader`'s `signedInAs` link points here, and
 * `(customer)/layout.tsx`'s SSR auth guard lands here after login — so it was
 * the first thing every customer saw, every session, and it told them nothing.
 *
 * Built entirely on capabilities that already existed: no endpoint,
 * controller, service, DTO or migration was added for it.
 *
 * ## Two things deliberately NOT here
 *
 * **No ticket status breakdown** ("3 open, 2 resolved"). It cannot be computed
 * honestly: `ListPortalTicketsQueryDto` accepts only `page`/`pageSize` — the
 * controller's own comment says "no other filters exist for this list" — and
 * `DEFAULT_PAGE_SIZE` is 25, so counting statuses from the first page would be
 * *silently wrong* for any customer with more than 25 tickets. What is shown
 * instead is correct by construction: the envelope's `total` (which counts
 * every matching row regardless of page) and the most recent tickets (the API
 * already orders `createdAt desc`). Making a breakdown correct needs a status
 * filter or a counts endpoint — a backend change, and a separate story.
 *
 * **No unread-notification tile.** `PortalHeader` already renders the unread
 * count as a badge on the notifications nav link on every authenticated page.
 * A second copy here would repeat the same number centimetres below it and add
 * a second subscriber to the same query for no new information.
 *
 * ## Shape
 *
 * Each panel owns its own query and its own loading/error/empty/populated
 * branches, so one failing never blanks the other. Errors render through the
 * shared `Alert` (Story 135), reusing the existing `tickets.list.*` /
 * `knowledgeBase.list.*` copy rather than declaring near-duplicate strings.
 * Surfaces use the inline `rounded-md border border-rule bg-surface p-4`
 * convention every other portal view uses — `@crm/ui` exports `Card`, but no
 * file in either app uses it, and adopting it here would be a design-system
 * change this story is not.
 */

/** A bounded preview, never a replacement for the full listings: both panels
 * link on to their own screen, which keeps its own pagination. Sliced from the
 * first page both queries already fetch (`DEFAULT_PAGE_SIZE` is 25), so this
 * costs no extra request and needs no new query parameter. */
const HOME_PREVIEW_COUNT = 5;

const SURFACE = "rounded-md border border-rule bg-surface p-4";

export function PortalHomeView() {
  const t = useTranslations("home");
  const tTickets = useTranslations("tickets");
  const tKnowledgeBase = useTranslations("knowledgeBase");
  const tChat = useTranslations("chat");
  const tNotifications = useTranslations("notifications");
  const { locale } = useParams<{ locale: string }>();

  const ticketsQuery = useMyTicketsQuery();
  /** Same `locale.toUpperCase()` derivation `ArticleListView` uses, so this
   * shares that screen's query key (which includes `locale`) and its cache
   * rather than issuing a second, differently-keyed fetch. */
  const articlesQuery = usePublishedArticlesQuery(
    undefined,
    locale.toUpperCase() as KbLocale,
  );

  const ticketPage = ticketsQuery.data;
  const recentTickets = ticketPage?.items.slice(0, HOME_PREVIEW_COUNT);
  const articlePage = articlesQuery.data;
  const previewArticles = articlePage?.items.slice(0, HOME_PREVIEW_COUNT);

  return (
    <div className="flex flex-col gap-4">
      <section className={SURFACE}>
        <h1 className="text-lg font-semibold text-ink">{t("welcomeHeading")}</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{t("welcomeBody")}</p>
      </section>

      <section className={SURFACE}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("tickets.heading")}</h2>
          <Link
            href={`/${locale}/tickets`}
            className="focus-ring shrink-0 rounded-sm text-sm font-medium text-ink hover:underline"
          >
            {t("tickets.viewAll")}
          </Link>
        </div>

        {ticketsQuery.isPending && <Skeleton className="mt-3 h-24 w-full" />}

        {ticketsQuery.isError && (
          <Alert variant="destructive" className="mt-3 flex items-center justify-between">
            <span>{tTickets("list.error")}</span>
            <Button variant="outline" size="sm" onClick={() => ticketsQuery.refetch()}>
              {tTickets("list.retry")}
            </Button>
          </Alert>
        )}

        {ticketPage !== undefined && ticketPage.total === 0 && (
          <p className="mt-3 text-sm text-ink-subtle">{t("tickets.empty")}</p>
        )}

        {ticketPage !== undefined && ticketPage.total > 0 && (
          <>
            {/* The envelope's own `total`, never `items.length` — the list
                below is capped at HOME_PREVIEW_COUNT, so the two genuinely
                differ and the "view all" link is what reconciles them. */}
            <p className="mt-3 text-sm text-ink-muted">
              {t("tickets.total", { count: ticketPage.total })}
            </p>
            <ol className="mt-2 flex flex-col gap-2 text-sm">
              {recentTickets?.map((ticket) => (
                <li
                  key={ticket.id}
                  className="flex items-center justify-between gap-2 border-b border-rule-subtle pb-2"
                >
                  {/* `min-w-0 break-words` / `shrink-0` / `gap-2`: a ticket
                      subject is free text the customer typed, and a flex
                      item's default `min-width: auto` refuses to shrink below
                      an unbreakable word — the exact overflow
                      `ArticleListView`'s own row documents having measured at
                      390px. The status/date column stays `shrink-0` so it is
                      never squeezed instead. */}
                  <Link
                    href={`/${locale}/tickets/${ticket.id}`}
                    className="focus-ring min-w-0 break-words rounded-sm font-medium text-ink-strong hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-ink-subtle">
                    <Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                    <span>{new Date(ticket.createdAt).toLocaleDateString(locale)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className={SURFACE}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("knowledgeBase.heading")}</h2>
          <Link
            href={`/${locale}/knowledge-base`}
            className="focus-ring shrink-0 rounded-sm text-sm font-medium text-ink hover:underline"
          >
            {t("knowledgeBase.viewAll")}
          </Link>
        </div>

        {articlesQuery.isPending && <Skeleton className="mt-3 h-24 w-full" />}

        {articlesQuery.isError && (
          <Alert variant="destructive" className="mt-3 flex items-center justify-between">
            <span>{tKnowledgeBase("list.error")}</span>
            <Button variant="outline" size="sm" onClick={() => articlesQuery.refetch()}>
              {tKnowledgeBase("list.retry")}
            </Button>
          </Alert>
        )}

        {previewArticles !== undefined && previewArticles.length === 0 && (
          <p className="mt-3 text-sm text-ink-subtle">{tKnowledgeBase("list.empty")}</p>
        )}

        {previewArticles !== undefined && previewArticles.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {previewArticles.map((article) => (
              <li
                key={article.id}
                className="flex items-center justify-between gap-2 border-b border-rule-subtle pb-2"
              >
                {/* Same free-text overflow treatment as the ticket rows above
                    — see `ArticleListView`'s own row for the measurement. */}
                <Link
                  href={`/${locale}/knowledge-base/${article.id}`}
                  className="focus-ring min-w-0 break-words rounded-sm font-medium text-ink-strong hover:underline"
                >
                  {article.title}
                </Link>
                <span className="shrink-0 text-ink-subtle">
                  {article.categoryName ?? tKnowledgeBase("list.noCategory")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={SURFACE}>
        <h2 className="text-sm font-semibold text-ink">{t("explore.heading")}</h2>
        {/* Existing destinations only — no new route, and `PortalHeader`'s own
            nav is untouched. The labels are the existing `*.nav` keys the
            header already uses, so this adds no new copy. */}
        <nav aria-label={t("explore.heading")} className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/${locale}/tickets`}
            className="focus-ring rounded-sm font-medium text-ink hover:underline"
          >
            {tTickets("nav")}
          </Link>
          <Link
            href={`/${locale}/knowledge-base`}
            className="focus-ring rounded-sm font-medium text-ink hover:underline"
          >
            {tKnowledgeBase("nav")}
          </Link>
          <Link
            href={`/${locale}/chat`}
            className="focus-ring rounded-sm font-medium text-ink hover:underline"
          >
            {tChat("nav")}
          </Link>
          <Link
            href={`/${locale}/notifications`}
            className="focus-ring rounded-sm font-medium text-ink hover:underline"
          >
            {tNotifications("nav")}
          </Link>
        </nav>
      </section>
    </div>
  );
}
