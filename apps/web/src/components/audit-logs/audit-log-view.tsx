"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuditLogsQuery } from "@/hooks/use-audit-logs";
import { useUsersQuery } from "@/hooks/use-tickets";
import type { AuditLogFilters, AuditLogSummary } from "@/lib/audit-logs-api";
import { ApiError } from "@/lib/api";
import {
  Alert,
  Badge,
  Button,
  DescriptionItem,
  DescriptionList,
  FetchingIndicator,
  Input,
  ListToolbar,
  LoadingStatus,
  PageHeader,
  Pagination,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
} from "@crm/ui";
import { EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@crm/ui";
import { formatDateTime } from "@crm/ui";

/** Story 228 — the actions the API records by name (the identity
 * domain's own audit trail). Anything else is shown as recorded. */
const NAMED_ACTIONS = new Set([
  "auth.login",
  "auth.login_failed",
  "auth.login_blocked",
  "auth.account_locked",
  "auth.logout",
  "auth.branch_switched",
  "user.unlocked",
  "user.branch_assignment_granted",
  "user.password_reset",
  "user.password_changed",
  "user.reassigned",
  "role.updated",
  "role.permissions_updated",
]);
const ENTITY_TYPES = new Set(["user", "role", "http_request"]);
const HTTP_ACTION = /^(POST|PUT|PATCH|DELETE) (\S+)$/;

type AuditT = ReturnType<typeof useTranslations<"auditLogs">>;
type AuditKey = Parameters<AuditT>[0];

/**
 * Story 228 — an action in the reader's language. Named actions have their
 * own label; the request trail every mutation leaves ("PATCH /tickets/:id")
 * reads as its verb ("Update") with the path beside it. Anything else is
 * shown as recorded, which is also what the action filter matches.
 */
function describeAction(action: string, t: AuditT): { label: string; path?: string } {
  if (NAMED_ACTIONS.has(action)) {
    return { label: t(`actions.${action.replace(".", "_")}` as AuditKey) };
  }
  const http = HTTP_ACTION.exec(action);
  if (http) {
    return { label: t(`httpVerbs.${http[1]}` as AuditKey), path: http[2] };
  }
  return { label: action };
}

function entityTypeLabel(entityType: string, t: AuditT): string {
  return ENTITY_TYPES.has(entityType) ? t(`entityTypes.${entityType}` as AuditKey) : entityType;
}

function ActionCell({ action }: { action: string }) {
  const t = useTranslations("auditLogs");
  const { label, path } = describeAction(action, t);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-tight">
      <Badge variant="outline">{label}</Badge>
      {path && (
        <code dir="ltr" className="break-all text-caption text-ink-subtle">
          {path}
        </code>
      )}
    </span>
  );
}

/**
 * Story 228 — the change set opens in a Sheet instead of stretching the
 * row with a JSON block; the Sheet also carries the entry's full record.
 */
function DiffCell({ log, actor, when }: { log: AuditLogSummary; actor: ReactNode; when: string }) {
  const t = useTranslations("auditLogs");
  if (log.diff === null || log.diff === undefined) {
    return <span className="text-ink-subtle">{t("noDiff")}</span>;
  }
  const { label } = describeAction(log.action, t);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("viewChangesFor", { action: label, when })}
        >
          {t("viewChanges")}
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={t("closeChanges")}>
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription>{when}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-section">
          <DescriptionList columns={2}>
            <DescriptionItem term={t("columns.actor")}>{actor}</DescriptionItem>
            <DescriptionItem term={t("columns.action")}>
              <code dir="ltr" className="break-all text-caption">
                {log.action}
              </code>
            </DescriptionItem>
            <DescriptionItem term={t("columns.entityType")}>
              {entityTypeLabel(log.entityType, t)}
            </DescriptionItem>
            <DescriptionItem term={t("columns.entityId")}>
              {log.entityId ?? t("noEntityId")}
            </DescriptionItem>
            <DescriptionItem term={t("columns.branch")}>
              {log.branchId ?? t("noBranch")}
            </DescriptionItem>
            <DescriptionItem term={t("columns.ipAddress")}>
              {log.ipAddress ?? t("noIpAddress")}
            </DescriptionItem>
          </DescriptionList>
          <section className="flex flex-col gap-tight">
            <h3 className="text-label text-ink">{t("columns.diff")}</h3>
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-control bg-surface-muted p-3 text-xs text-ink-muted"
            >
              {JSON.stringify(log.diff, null, 2)}
            </pre>
          </section>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/**
 * One row's actor cell — resolved through the already-fetched, already-
 * shared `useUsersQuery()` cache (Story 25's own customer/user name-
 * resolution convention, e.g. `TicketListView`'s `userNameById`): a `null`
 * `actorId` means the action happened before/without tenant context (e.g. a
 * login attempt — `AuditLogsService`'s own doc comment), rendered as
 * "System" rather than blank; a non-null `actorId` this branch's user list
 * doesn't contain (a deleted user, or one outside this lookup) falls back to
 * the raw id, exactly like `TicketListView`'s existing fallback.
 */
function ActorCell({
  actorId,
  nameById,
}: {
  actorId: string | null;
  nameById: Map<string, string>;
}) {
  const t = useTranslations("auditLogs");
  if (!actorId) {
    return <span className="text-ink-subtle">{t("systemActor")}</span>;
  }
  return <span>{nameById.get(actorId) ?? actorId}</span>;
}

/**
 * Story 40 — Audit Log Viewer, over the already-existing `GET /audit-logs`
 * (Story 37, never before consumed by any frontend). Entirely read-only —
 * no mutation exists anywhere on this screen. Mirrors `TicketListView`'s
 * loading/empty conventions; the query-level 403 (rather than a mutation's,
 * since nothing here ever mutates) is distinguished from a generic failure
 * the same way `TicketDetailView`/`BusinessHoursView` already distinguish a
 * specific `ApiError.status` from every other failure — shown as its own
 * message with no retry action, since retrying with the same permissions
 * cannot change the outcome.
 *
 * Story 104 — a filter bar: blur-commit `action`/`entityType` `Input`s
 * (mirrors `TicketListView`'s own `category` filter `Input` — both are
 * exact-match backend filters, not full-text search) plus a `{from, to}`
 * date-range pair (mirrors `ReportsView`'s own Story 93 date `Input`
 * pair). No `actorId` filter control — the backend supports it, but a
 * usable picker needs the same name-resolution this view already does
 * for *display*, not just an id text box; deferred rather than shipping
 * a raw-UUID input.
 */
export function AuditLogView() {
  const t = useTranslations("auditLogs");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();

  /**
   * Story S-8a — `page` lives in the same object as the filters, so it is
   * part of the query key and a page change behaves exactly like a filter
   * change. It is 1-based and left undefined until the reader actually
   * pages, which keeps the first request identical to the pre-S-8a one.
   */
  const [filters, setFilters] = useState<AuditLogFilters>({});
  /** Story 228 — the two text filters commit on blur, so they hold their
   * own text; "Clear all" remounts them to empty them too. */
  const [clearCount, setClearCount] = useState(0);
  const auditLogsQuery = useAuditLogsQuery(filters);
  const usersQuery = useUsersQuery();

  /** The rows to render, whoever they came from: the current page, or the
   * page being left still shown as placeholder data while the next one
   * loads. `undefined` means nothing has arrived yet. */
  const page = auditLogsQuery.data;
  const logs = page?.items;

  /**
   * Every filter change resets to page 1 in the SAME state update.
   * Splitting it into a separate effect would first fire a request for
   * "page 7 of the new filter" and only then correct itself — a wasted
   * round trip that also flashes the wrong rows.
   */
  function updateFilter<K extends keyof AuditLogFilters>(key: K, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined, page: undefined }));
  }

  const actorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  const forbidden =
    auditLogsQuery.isError &&
    auditLogsQuery.error instanceof ApiError &&
    auditLogsQuery.error.status === 403;

  return (
    <section className="flex flex-col gap-4">
      {/* Story S-8a/S-7 — the rows of the page being left stay on screen
          while the next page loads, so the indicator is the only signal that
          a page change is in flight. Story 198 — it sits in PageHeader's
          `actions`, the title's own row, so it still adds no height. */}
      <PageHeader
        title={t("title")}
        actions={
          <FetchingIndicator
            active={auditLogsQuery.isPlaceholderData}
            label={tCommon("updating")}
          />
        }
      />

      {/* Story 228 — the shared list toolbar: the filters (in a sheet on
          a phone) and "Clear all" once any is set. */}
      <ListToolbar
        filterCount={
          [filters.action, filters.entityType, filters.from || filters.to].filter(Boolean).length
        }
        filtersLabel={t("filtersLabel")}
        closeLabel={t("closeFilters")}
        onClearAll={() => {
          setFilters({});
          setClearCount((count) => count + 1);
        }}
        clearAllLabel={t("filterClear")}
        className="[&>div:first-child]:items-end"
        filters={
          <>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t("filterAction")}
              <Input
                className="min-w-[10rem]"
                key={`action-${clearCount}`}
                defaultValue={filters.action ?? ""}
                placeholder={t("filterActionPlaceholder")}
                onBlur={(event) => updateFilter("action", event.target.value.trim())}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t("filterEntityType")}
              <Input
                className="min-w-[10rem]"
                key={`entityType-${clearCount}`}
                defaultValue={filters.entityType ?? ""}
                placeholder={t("filterEntityTypePlaceholder")}
                onBlur={(event) => updateFilter("entityType", event.target.value.trim())}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t("filterFrom")}
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filters.from ?? ""}
                onChange={(event) => updateFilter("from", event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t("filterTo")}
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filters.to ?? ""}
                onChange={(event) => updateFilter("to", event.target.value)}
              />
            </label>
          </>
        }
      />

      {/* Story S-8a — `isPending`, not `isLoading`: with placeholder data
          in play the query only reports `pending` on a genuine first load,
          so the skeleton appears once and never again for a page change. */}
      {auditLogsQuery.isPending && (
        <LoadingStatus label={tCommon("loading")} className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </LoadingStatus>
      )}

      {auditLogsQuery.isError && forbidden && <Alert variant="destructive">{t("forbidden")}</Alert>}

      {auditLogsQuery.isError && !forbidden && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => auditLogsQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {logs !== undefined && logs.length === 0 && <EmptyState title={t("empty")} />}

      {logs !== undefined && logs.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.createdAt")}</TableHead>
                <TableHead>{t("columns.actor")}</TableHead>
                <TableHead>{t("columns.action")}</TableHead>
                <TableHead>{t("columns.entityType")}</TableHead>
                <TableHead>{t("columns.entityId")}</TableHead>
                <TableHead>{t("columns.branch")}</TableHead>
                <TableHead>{t("columns.ipAddress")}</TableHead>
                <TableHead>{t("columns.diff")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: AuditLogSummary) => (
                <TableRow key={log.id}>
                  {/* Story 150 — every cell's `label` reuses its own
                      column's translation key, so the mobile label and the
                      desktop header cannot drift apart. Below `sm` the
                      header row is hidden and these eight values would
                      otherwise stack as anonymous lines. */}
                  <TableCell label={t("columns.createdAt")} className="text-ink-subtle">
                    {formatDateTime(log.createdAt, locale)}
                  </TableCell>
                  <TableCell label={t("columns.actor")}>
                    <ActorCell actorId={log.actorId} nameById={actorNameById} />
                  </TableCell>
                  <TableCell label={t("columns.action")}>
                    <ActionCell action={log.action} />
                  </TableCell>
                  <TableCell label={t("columns.entityType")}>
                    {entityTypeLabel(log.entityType, t)}
                  </TableCell>
                  <TableCell label={t("columns.entityId")} className="text-ink-subtle">
                    {log.entityId ?? <span className="text-ink-subtle">{t("noEntityId")}</span>}
                  </TableCell>
                  <TableCell label={t("columns.branch")} className="text-ink-subtle">
                    {log.branchId ?? <span className="text-ink-subtle">{t("noBranch")}</span>}
                  </TableCell>
                  <TableCell label={t("columns.ipAddress")} className="text-ink-subtle">
                    {log.ipAddress ?? <span className="text-ink-subtle">{t("noIpAddress")}</span>}
                  </TableCell>
                  <TableCell label={t("columns.diff")}>
                    <DiffCell
                      log={log}
                      actor={<ActorCell actorId={log.actorId} nameById={actorNameById} />}
                      when={formatDateTime(log.createdAt, locale)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Renders nothing while there is only one page (see `Pagination`),
          so an unfiltered short trail looks exactly as it did before.
          Disabled while the previous page is still on screen, so a rapid
          double-click cannot queue a second jump. */}
      {page !== undefined && (
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          onPageChange={(next) => setFilters((current) => ({ ...current, page: next }))}
          disabled={auditLogsQuery.isPlaceholderData}
          label={tCommon("pagination.label")}
          previousLabel={tCommon("pagination.previous")}
          nextLabel={tCommon("pagination.next")}
          indicator={tCommon("pagination.indicator", {
            page: page.page,
            totalPages: page.totalPages,
          })}
        />
      )}
    </section>
  );
}
