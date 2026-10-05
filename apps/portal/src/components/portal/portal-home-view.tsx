"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ticketStatusPresentation } from "@crm/shared";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { usePublishedArticlesQuery } from "@/hooks/use-portal-knowledge-base";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import type { KbLocale } from "@/lib/knowledge-base-api";
import type { PortalTicketSummary } from "@/lib/tickets-api";
import {
  AddIcon,
  AiSummaryIcon,
  Alert,
  Button,
  Card,
  KnowledgeBaseIcon,
  LoadingStatus,
  PageHeader,
  SearchIcon,
  Skeleton,
  cn,
  recipes,
  toneSpine,
  type LucideIcon,
} from "@crm/ui";
import { formatDate } from "@crm/ui";

/**
 * Story 136 — the Customer Portal's real landing page.
 *
 * Built entirely on capabilities that already existed: no endpoint,
 * controller, service, DTO or migration was added for it.
 *
 * ## Two things deliberately NOT here
 *
 * **No ticket status breakdown** ("3 open, 2 resolved"). It cannot be computed
 * honestly: `ListPortalTicketsQueryDto` accepts only `page`/`pageSize`, and
 * `DEFAULT_PAGE_SIZE` is 25, so counting statuses from the first page would be
 * *silently wrong* for any customer with more than 25 tickets. What is shown
 * instead is correct by construction: the envelope's `total` and the most
 * recent tickets (the API already orders `createdAt desc`).
 *
 * **No unread-notification tile.** `PortalHeader` already renders the unread
 * count as a badge on the notifications nav link on every authenticated page.
 *
 * ## Shape
 *
 * Each panel owns its own query and its own loading/error/empty/populated
 * branches, so one failing never blanks the other.
 *
 * Story 229 (PR-5.1) — redesigned: the three things a customer comes to do
 * (raise a ticket, search the help articles, ask the assistant) are the
 * first row, as action cards; recent tickets carry the same status spine
 * agents see on the board; help highlights sit beside them on a wide screen.
 * The former "Explore" link row is gone — the action cards and the header
 * nav cover every destination it listed.
 */

/** A bounded preview, never a replacement for the full listings: both panels
 * link on to their own screen, which keeps its own pagination. Sliced from the
 * first page both queries already fetch, so this costs no extra request. */
const HOME_PREVIEW_COUNT = 5;

/** Story 229 — one of the three primary actions. */
function ActionCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        recipes.card,
        recipes.liftable,
        "focus-ring group flex items-start gap-3 p-surface hover:border-rule-strong",
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent-surface text-accent"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-tight">
        <span className="font-semibold text-ink group-hover:underline">{title}</span>
        <span className="text-sm text-ink-muted">{body}</span>
      </span>
    </Link>
  );
}

/** Story 229 — a recent ticket with the status spine on its leading edge. */
function TicketMiniCard({ ticket, locale }: { ticket: PortalTicketSummary; locale: string }) {
  const spine = toneSpine(ticketStatusPresentation(ticket.status).tone);
  return (
    <Link
      href={`/${locale}/tickets/${ticket.id}`}
      className={cn(
        "focus-ring flex flex-col gap-1.5 rounded-control border border-s-[3px] border-rule-subtle bg-surface px-3 py-2.5 hover:bg-surface-muted",
        spine.start,
      )}
    >
      {/* `break-words`: a subject is free text the customer typed, and one
          long unbreakable word must wrap rather than widen the card. */}
      <span className="min-w-0 break-words font-medium text-ink-strong">{ticket.subject}</span>
      <span className="flex flex-wrap items-center gap-2 text-caption text-ink-subtle">
        <TicketStatusBadge status={ticket.status} />
        <span>{formatDate(ticket.createdAt, locale)}</span>
        {ticket.categoryName && <span>· {ticket.categoryName}</span>}
      </span>
    </Link>
  );
}

function PanelHeading({ title, link }: { title: string; link: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {link}
    </div>
  );
}

export function PortalHomeView() {
  const t = useTranslations("home");
  const tTickets = useTranslations("tickets");
  const tKnowledgeBase = useTranslations("knowledgeBase");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();

  const ticketsQuery = useMyTicketsQuery();
  /** Same `locale.toUpperCase()` derivation `ArticleListView` uses, so this
   * shares that screen's query key (which includes `locale`) and its cache
   * rather than issuing a second, differently-keyed fetch. */
  const articlesQuery = usePublishedArticlesQuery(undefined, locale.toUpperCase() as KbLocale);

  const ticketPage = ticketsQuery.data;
  const recentTickets = ticketPage?.items.slice(0, HOME_PREVIEW_COUNT);
  const articlePage = articlesQuery.data;
  const previewArticles = articlePage?.items.slice(0, HOME_PREVIEW_COUNT);

  const viewAllClassName =
    "focus-ring shrink-0 rounded-sm text-sm font-medium text-accent hover:underline";

  return (
    <div className="flex flex-col gap-section">
      <PageHeader title={t("welcomeHeading")} description={t("welcomeBody")} />

      <nav aria-label={t("actions.label")} className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          href={`/${locale}/tickets#new-ticket`}
          icon={AddIcon}
          title={t("actions.newTicket.title")}
          body={t("actions.newTicket.body")}
        />
        <ActionCard
          href={`/${locale}/knowledge-base`}
          icon={SearchIcon}
          title={t("actions.searchHelp.title")}
          body={t("actions.searchHelp.body")}
        />
        <ActionCard
          href={`/${locale}/chat`}
          icon={AiSummaryIcon}
          title={t("actions.askAssistant.title")}
          body={t("actions.askAssistant.body")}
        />
      </nav>

      <div className="grid gap-section lg:grid-cols-5">
        <Card asChild className="p-surface lg:col-span-3">
          <section>
            <PanelHeading
              title={t("tickets.heading")}
              link={
                <Link href={`/${locale}/tickets`} className={viewAllClassName}>
                  {t("tickets.viewAll")}
                </Link>
              }
            />

            {ticketsQuery.isPending && (
              <LoadingStatus label={tCommon("loading")} asChild>
                <Skeleton className="mt-3 h-24 w-full" />
              </LoadingStatus>
            )}

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
                    below is capped at HOME_PREVIEW_COUNT. */}
                <p className="mt-1 text-caption text-ink-subtle">
                  {t("tickets.total", { count: ticketPage.total })}
                </p>
                <ol className="mt-3 flex flex-col gap-2 text-sm">
                  {recentTickets?.map((ticket) => (
                    <li key={ticket.id}>
                      <TicketMiniCard ticket={ticket} locale={locale} />
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        </Card>

        <Card asChild className="p-surface lg:col-span-2">
          <section>
            <PanelHeading
              title={t("knowledgeBase.heading")}
              link={
                <Link href={`/${locale}/knowledge-base`} className={viewAllClassName}>
                  {t("knowledgeBase.viewAll")}
                </Link>
              }
            />

            {articlesQuery.isPending && (
              <LoadingStatus label={tCommon("loading")} asChild>
                <Skeleton className="mt-3 h-24 w-full" />
              </LoadingStatus>
            )}

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
              <ol className="mt-3 flex flex-col text-sm">
                {previewArticles.map((article) => (
                  <li key={article.id} className="border-b border-rule-subtle last:border-b-0">
                    <Link
                      href={`/${locale}/knowledge-base/${article.id}`}
                      className="focus-ring group flex items-start gap-2 rounded-sm py-2.5"
                    >
                      <KnowledgeBaseIcon
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="break-words font-medium text-ink-strong group-hover:underline">
                          {article.title}
                        </span>
                        <span className="text-caption text-ink-subtle">
                          {article.categoryName ?? tKnowledgeBase("list.noCategory")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </Card>
      </div>
    </div>
  );
}
