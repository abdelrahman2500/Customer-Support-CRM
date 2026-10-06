"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useTicketsQuery, useUpdateTicketMutation } from "@/hooks/use-tickets";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/tickets/ticket-badges";
import { SlaIndicator } from "@/components/tickets/sla-indicator";
import { ApiError } from "@/lib/api";
import {
  Alert,
  BarChart,
  Button,
  DistributionBar,
  DonutGauge,
  EmptyState,
  LoadingStatus,
  PageHeader,
  SectionCard,
  Skeleton,
  StatCard,
  recipes,
} from "@crm/ui";
import { deriveSlaStatus } from "@/lib/sla";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import { COUNTED_STATUSES, useTicketStatusCounts } from "@/hooks/use-ticket-status-counts";
import { useSlaComplianceQuery, useTicketVolumeByCategoryQuery } from "@/hooks/use-reporting";
import { statusSpine } from "@/components/tickets/board/board-state";
import { TasksPanel } from "./tasks-panel";

/** Story 28 — a work queue, not a full history: only tickets still open
 * belong on the dashboard. `RESOLVED`/`CLOSED` tickets remain reachable via
 * the existing Ticket List. Story 29 reuses this same set for the
 * "Unclaimed tickets" section — an unassigned ticket that's already
 * resolved/closed has nothing left to claim. */
/** Story 28/29 — this screen's own definition of "still needs work".
 * Story S-9 — a typed list rather than a `Set`: it is now sent to the API
 * as the panels' `statuses` filter instead of being tested with `.has`
 * after the fetch, so it has to be exactly the API's own union. */
const OPEN_STATUSES: readonly TicketStatus[] = ["OPEN", "IN_PROGRESS"];

/**
 * Story S-9 — the SLA-urgency ranking these panels show is now
 * `GET /tickets?sortBy=slaUrgency`, and the `slaSortKey`/`sortByUrgency`
 * helpers that lived here are gone with it.
 *
 * They ranked breached-first, then soonest-target, then no-target last.
 * That key is equal to plain "governing target ascending, nulls last": a
 * breached ticket's target is in the past and an on-track one's is in the
 * future, so the rank term never changed the order — which is also why the
 * ranking never actually depended on `now`. `deriveSlaStatus` is still
 * used below, for the per-row badge and remaining-time text, which do.
 */

/** Story 221 (PR-3.6) — how many of my tickets "Needs you now" shows; the
 * rest are one link away on the board. */
const NEEDS_YOU_LIMIT = 6;

/**
 * Story 221 (PR-3.6) — one figure of "your shift at a glance", on the shared
 * `StatCard` (it replaces Story 144's local StatTile). Each figure links to
 * the board view that lists exactly those tickets.
 */
function ShiftStat({
  label,
  value,
  loading,
  href,
  edge,
  hint,
}: {
  label: string;
  value: number | string | undefined;
  loading: boolean;
  href: string;
  edge?: string;
  hint?: string;
}) {
  return (
    <StatCard label={label} value={value} loading={loading} edge={edge} hint={hint} asChild>
      <Link href={href} className="focus-ring hover:border-rule-strong" />
    </StatCard>
  );
}

/**
 * Story 29 — one row of the "Unclaimed tickets" section. A dedicated
 * component (not inline in a `.map()`) because `useUpdateTicketMutation(id)`
 * is a hook and must be called once per component instance, not once per
 * loop iteration (React's rules of hooks) — the same per-ticket-id binding
 * `TicketDetailView` already relies on, just repeated per list item here.
 * Reuses the existing `PATCH /tickets/:id` mutation verbatim: claiming is
 * exactly `{ assignedToUserId: currentUserId }`, the same payload shape
 * `TicketDetailView`'s own assignee `Select` already sends. Never
 * optimistic — the row keeps rendering from the still-stale list until the
 * mutation's own existing `["tickets"]` cache invalidation causes a real
 * refetch, which then naturally excludes the now-assigned ticket.
 */
function UnclaimedTicketRow({
  ticket,
  customerName,
  now,
  currentUserId,
}: {
  ticket: TicketListItem;
  customerName: string;
  now: Date;
  currentUserId: string;
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const mutation = useUpdateTicketMutation(ticket.id);

  return (
    <li className="flex flex-col gap-2 border-b border-rule-subtle pb-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span
        className="flex min-w-0 flex-1 cursor-pointer flex-col"
        onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
      >
        <Link
          href={`/${locale}/tickets/${ticket.id}`}
          className="focus-ring w-fit max-w-full break-words rounded-sm font-medium text-ink-strong hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {ticket.subject}
        </Link>
        <Link
          href={`/${locale}/customers/${ticket.customerId}`}
          className="focus-ring w-fit rounded-sm text-xs text-ink-subtle hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {customerName}
        </Link>
        {mutation.isError && (
          <span role="alert" className="text-xs text-danger-foreground">
            {mutation.error instanceof ApiError && mutation.error.status === 403
              ? t("claimForbidden")
              : t("claimFailed")}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-2">
        <TicketStatusBadge status={ticket.status} />
        <TicketPriorityBadge priority={ticket.priority} />
        <SlaIndicator target={ticket.slaTarget} createdAt={ticket.createdAt} now={now} />
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={(event) => {
            event.stopPropagation();
            mutation.mutate({ assignedToUserId: currentUserId });
          }}
        >
          {mutation.isPending ? t("claiming") : t("claimButton")}
        </Button>
      </span>
    </li>
  );
}

/**
 * Story 28 — replaces the Story 23 `/dashboard` redirect stub. Fetches the
 * authenticated agent's own tickets via the existing `GET
 * /tickets?assignedToUserId=` filter (Story 23) — never the branch-wide
 * list. No filter/sort/search UI — this is a fixed, pre-scoped view
 * (plan §6/§9).
 *
 * Story S-9 — supersedes Story 28's and Story 29's client-side refinement.
 * Narrowing to open work and ranking by SLA urgency are both the server's
 * answer now, so the panels render the page they are given, in order. The
 * "fetch the already-scoped result, refine client-side" precedent Story 27
 * established is what pagination made untenable: refining after the fetch
 * can only ever discard rows from a window the server chose on some other
 * basis.
 *
 * Story 29 — adds a second, independent "Unclaimed tickets" section: the
 * same unfiltered `GET /tickets` call `CustomerDetailView`/`TicketListView`
 * already make, narrowed client-side to `assignedToUserId === null` and an
 * open status, with a "Claim" action per row. The existing Ticket List is
 * not modified — `assignedToUserId` is validated `@IsUUID()` server-side
 * and cannot express "no assignee" as a query parameter, so this queue
 * lives here, using the same client-side-filtering pattern already
 * established, rather than inventing a new backend contract.
 *
 * Story S-8d — supersedes Story 29's client-side narrowing. "Unclaimed"
 * is now asked of the server (`GET /tickets?unassigned=true`) instead of
 * being filtered out of the branch-wide list, and the customer name
 * arrives on the ticket rather than from a separate customer fetch. Story
 * 28's own-tickets section is unchanged. The Story 29 approach could not
 * survive pagination — and was already lossy, since an unclaimed ticket
 * outside the list's cap was invisible here.
 */
export function DashboardView({ userId }: { userId: string }) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const labels = useTicketLabels();
  const statusCounts = useTicketStatusCounts();
  // Story 221 — branch figures for `report:read` users; a 403 hides them.
  const [since] = useState(() =>
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const slaComplianceQuery = useSlaComplianceQuery({ from: since });
  const volumeByCategoryQuery = useTicketVolumeByCategoryQuery({ from: since });
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  /**
   * Story S-9 — the server now answers both of this screen's questions.
   *
   * S-8e had to take a bounded 100-row window here because the urgency
   * ranking was computed in the browser: the server could not return "the
   * 25 most urgent", so a pager would have let page 2 hold a more urgent
   * ticket than page 1. `sortBy: "slaUrgency"` removes that constraint —
   * the first page IS the most urgent page, which is exactly what a
   * dashboard panel wants — so the window and its documented caveat both
   * go away.
   *
   * `statuses` has to move server-side with the ordering, not stay a
   * client-side filter. An SLA target outlives the ticket being resolved,
   * so a resolved ticket's long-past target ranks as maximally urgent;
   * filtering after the fetch would let those fill the page ahead of open
   * work that is genuinely breaching. Which statuses count as "still needs
   * work" is still this screen's own definition (Story 28's
   * `OPEN_STATUSES`) — only the filtering moved.
   */
  const PANEL_STATUSES = [...OPEN_STATUSES];
  const myTicketsQuery = useTicketsQuery({
    assignedToUserId: userId,
    statuses: PANEL_STATUSES,
    sortBy: "slaUrgency",
  });
  /**
   * Story S-8d — asks the server for unclaimed tickets instead of fetching
   * the branch-wide list and filtering it here.
   *
   * The old `useTicketsQuery({})` returned the newest 500 tickets and this
   * screen then picked the unassigned ones out of them, so an unclaimed
   * ticket older than that window could never appear — and the oldest
   * unclaimed ticket is exactly the one most needing attention. Asking the
   * question server-side fixes that outright, and it is what lets
   * `GET /tickets` be paginated without this panel silently narrowing
   * further.
   */
  const unclaimedTicketsQuery = useTicketsQuery({
    unassigned: "true",
    statuses: PANEL_STATUSES,
    sortBy: "slaUrgency",
  });

  // `now` is computed once per fetched result, alongside the filter/sort
  // that depends on it, so the ordering and the on-screen remaining-time
  // text (rendered from the same `now`, passed to `SlaIndicator` below)
  // can never disagree with each other.
  const { openTickets, now } = useMemo(() => {
    // Story S-9 — the rows arrive already narrowed and already ranked. `now`
    // is still computed once per result, because the remaining-time text
    // `SlaIndicator` renders is derived from it and must not disagree
    // with itself across a row.
    const now = new Date();
    return { openTickets: myTicketsQuery.data?.items ?? [], now };
  }, [myTicketsQuery.data]);

  const { unclaimedTickets, now: unclaimedNow } = useMemo(() => {
    // Story S-9 — see above: assignment, status and ranking are all the
    // server's answer now.
    const now = new Date();
    return { unclaimedTickets: unclaimedTicketsQuery.data?.items ?? [], now };
  }, [unclaimedTicketsQuery.data]);

  /**
   * Story 221 (PR-3.6) — at risk and breached, among my open tickets. There
   * is no SLA-state filter on the API, so these are counted on the loaded
   * page — which is honest because the page is ranked by SLA urgency:
   * breached tickets come first, then at-risk ones. A count is exact unless
   * the whole page is that urgent and more pages exist; then it reads "25+"
   * instead of quietly under-reporting (Story 144's concern).
   */
  const urgency = useMemo(() => {
    const kinds = openTickets.map((ticket) => {
      const sla = deriveSlaStatus(ticket.slaTarget, now, { createdAt: ticket.createdAt });
      return sla.kind === "breached"
        ? "breached"
        : sla.kind === "on-track" && sla.atRisk
          ? "atRisk"
          : "calm";
    });
    const more = (myTicketsQuery.data?.total ?? 0) > openTickets.length;
    const last = kinds[kinds.length - 1];
    const breached = kinds.filter((kind) => kind === "breached").length;
    const atRisk = kinds.filter((kind) => kind === "atRisk").length;
    return {
      breached: more && last === "breached" ? `${breached}+` : breached,
      atRisk: more && last !== "calm" && last !== undefined ? `${atRisk}+` : atRisk,
      breachedCount: breached,
      atRiskCount: atRisk,
    };
  }, [openTickets, now, myTicketsQuery.data]);

  const board = (query: string) => `/${locale}/tickets?view=board&${query}`;
  const mineQuery = `assignedToUserId=${encodeURIComponent(userId)}`;
  const categoryRows = (volumeByCategoryQuery.data ?? [])
    .filter((row) => row.count > 0)
    .sort((x, y) => y.count - x.count)
    .slice(0, 5)
    .map((row) => ({
      id: row.categoryId ?? "none",
      label: row.categoryName ?? t("branch.uncategorized"),
      segments: [{ label: "", value: row.count, color: "rgb(var(--viz-1))" }],
    }));
  const compliance = slaComplianceQuery.data?.complianceRate;
  const showBranch = slaComplianceQuery.isSuccess || volumeByCategoryQuery.isSuccess;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />

      {/* Story 221 (PR-3.6) — "your shift at a glance": four figures, each a
          link into the board filtered to exactly those tickets. Mine and
          unclaimed are the list envelopes' `total`; at risk and breached
          are counted on the urgency-ranked page (see `urgency`). */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ShiftStat
          label={t("stats.assignedToMe")}
          value={myTicketsQuery.data?.total}
          loading={myTicketsQuery.isLoading}
          href={board(mineQuery)}
        />
        <ShiftStat
          label={t("stats.unclaimed")}
          value={unclaimedTicketsQuery.data?.total}
          loading={unclaimedTicketsQuery.isLoading}
          href={board("unassigned=true")}
        />
        <ShiftStat
          label={t("stats.atRisk")}
          value={myTicketsQuery.isSuccess ? urgency.atRisk : undefined}
          loading={myTicketsQuery.isLoading}
          href={board(`${mineQuery}&risk=1`)}
          edge={urgency.atRiskCount > 0 ? "border-warning-solid" : undefined}
          hint={t("stats.mineHint")}
        />
        <ShiftStat
          label={t("stats.breached")}
          value={myTicketsQuery.isSuccess ? urgency.breached : undefined}
          loading={myTicketsQuery.isLoading}
          href={board(`${mineQuery}&risk=1`)}
          edge={urgency.breachedCount > 0 ? "border-danger-solid" : undefined}
          hint={t("stats.mineHint")}
        />
      </div>

      {/* Story 221 — every ticket the agent can see, by status (the status
          spine colours); each legend entry opens the list filtered to it. */}
      <SectionCard title={t("distribution.heading")}>
        {statusCounts.isLoading ? (
          <LoadingStatus label={tCommon("loading")} asChild>
            <Skeleton className="mt-3 h-10 w-full" />
          </LoadingStatus>
        ) : statusCounts.isError ? (
          <p className="mt-2 text-sm text-ink-subtle">{t("distribution.error")}</p>
        ) : (
          <DistributionBar
            className="mt-3"
            linkAs={Link}
            ariaLabel={t("distribution.label", {
              summary: COUNTED_STATUSES.map(
                (status) => `${labels.status(status)} ${statusCounts.counts[status] ?? 0}`,
              ).join(", "),
            })}
            segments={COUNTED_STATUSES.map((status) => ({
              key: status,
              label: labels.status(status),
              value: statusCounts.counts[status] ?? 0,
              tone: statusSpine(status).dot,
              href: `/${locale}/tickets?view=list&status=${status}`,
            }))}
          />
        )}
      </SectionCard>

      {/* The primary operational queue. `raised` is the one place on this
          page that takes elevation — `Card`'s own doc comment reserves it
          for "the one thing on a page that should draw the eye", and before
          this story every panel here carried identical weight. */}
      <SectionCard title={t("heading")} elevation="raised">
        {myTicketsQuery.isLoading && (
          <LoadingStatus label={tCommon("loading")} className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </LoadingStatus>
        )}

        {myTicketsQuery.isError && (
          <Alert variant="destructive" className="mt-2 flex items-center justify-between">
            <span>{t("error")}</span>
            <Button variant="outline" size="sm" onClick={() => myTicketsQuery.refetch()}>
              {t("retry")}
            </Button>
          </Alert>
        )}

        {/* Story 98 — Design System & Visual Polish. Recon flagged this as
            the clearest missing next-action: previously static text with
            no path forward when an agent has nothing open right now. */}
        {myTicketsQuery.isSuccess && openTickets.length === 0 && (
          <EmptyState
            className="mt-2"
            title={t("empty")}
            action={
              <Link
                href={`/${locale}/tickets`}
                className="focus-ring rounded-sm text-sm font-medium text-ink-strong hover:underline"
              >
                {t("browseAllTicketsLink")}
              </Link>
            }
          />
        )}

        {/* Story 221 — the most urgent of my tickets as mini cards (the same
            links, badges and SLA as before); the rest are on the board. */}
        {myTicketsQuery.isSuccess && openTickets.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {openTickets.slice(0, NEEDS_YOU_LIMIT).map((ticket) => (
              <li
                key={ticket.id}
                className={`${recipes.card} ${recipes.liftable} flex cursor-pointer flex-col gap-3 p-3`}
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
              >
                <span className="flex min-w-0 flex-col">
                  <Link
                    href={`/${locale}/tickets/${ticket.id}`}
                    className="focus-ring w-fit rounded-sm font-medium text-ink-strong hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {ticket.subject}
                  </Link>
                  <Link
                    href={`/${locale}/customers/${ticket.customerId}`}
                    className="focus-ring w-fit rounded-sm text-xs text-ink-subtle hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {/* Story S-8d — resolved by the API. */}
                    {ticket.customerName ?? ticket.customerId}
                  </Link>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <TicketStatusBadge status={ticket.status} />
                  <TicketPriorityBadge priority={ticket.priority} />
                  <SlaIndicator target={ticket.slaTarget} createdAt={ticket.createdAt} now={now} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {myTicketsQuery.isSuccess && (myTicketsQuery.data?.total ?? 0) > NEEDS_YOU_LIMIT && (
          <Link
            href={board(mineQuery)}
            className="focus-ring mt-3 inline-flex rounded-inner text-sm font-medium text-accent hover:underline"
          >
            {t("viewAllMine", { count: myTicketsQuery.data?.total ?? 0 })}
          </Link>
        )}
      </SectionCard>

      {/* Secondary panels: supporting context, side by side from lg up so
          they read as a tier below the queue rather than three equal
          full-width slabs. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TasksPanel userId={userId} />

        <SectionCard title={t("unassignedHeading")}>
          {unclaimedTicketsQuery.isLoading && (
            <LoadingStatus label={tCommon("loading")} className="mt-2 flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </LoadingStatus>
          )}

          {unclaimedTicketsQuery.isError && (
            <Alert variant="destructive" className="mt-2 flex items-center justify-between">
              <span>{t("unassignedError")}</span>
              <Button variant="outline" size="sm" onClick={() => unclaimedTicketsQuery.refetch()}>
                {t("retry")}
              </Button>
            </Alert>
          )}

          {unclaimedTicketsQuery.isSuccess && unclaimedTickets.length === 0 && (
            <EmptyState title={t("unassignedEmpty")} className="mt-2" />
          )}

          {unclaimedTicketsQuery.isSuccess && unclaimedTickets.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {unclaimedTickets.map((ticket) => (
                <UnclaimedTicketRow
                  key={ticket.id}
                  ticket={ticket}
                  customerName={ticket.customerName ?? ticket.customerId}
                  now={unclaimedNow}
                  currentUserId={userId}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Story 221 — branch figures for users with `report:read`, over the
          last 30 days. The UI has no permission model: an agent's 403 simply
          leaves this panel out. */}
      {showBranch && (
        <SectionCard title={t("branch.heading")}>
          <div className="mt-3 grid grid-cols-1 gap-section md:grid-cols-2">
            {slaComplianceQuery.isSuccess && (
              <div className="flex items-center gap-4">
                <DonutGauge
                  percent={compliance === null || compliance === undefined ? 0 : compliance * 100}
                  color="rgb(var(--success-solid))"
                  ariaLabel={t("branch.complianceLabel", {
                    rate:
                      compliance === null || compliance === undefined
                        ? "—"
                        : Math.round(compliance * 100),
                  })}
                />
                <div className="flex flex-col gap-tight">
                  {/* The gauge shows the rate; the text names it. */}
                  <span className="text-subhead text-ink-strong">{t("branch.compliance")}</span>
                  <span className="text-caption text-ink-muted">
                    {t("branch.complianceHint", {
                      met: slaComplianceQuery.data.compliantCount,
                      breached: slaComplianceQuery.data.breachedCount,
                    })}
                  </span>
                </div>
              </div>
            )}
            {volumeByCategoryQuery.isSuccess && categoryRows.length > 0 && (
              <div className="flex flex-col gap-stack">
                <h3 className="text-caption font-medium text-ink-muted">
                  {t("branch.byCategory")}
                </h3>
                <BarChart rows={categoryRows} ariaLabel={t("branch.byCategory")} />
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </section>
  );
}
