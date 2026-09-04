"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuditLogsQuery } from "@/hooks/use-audit-logs";
import { useUsersQuery } from "@/hooks/use-tickets";
import type { AuditLogFilters, AuditLogSummary } from "@/lib/audit-logs-api";
import { ApiError } from "@/lib/api";
import { Alert, Badge, Button, Input, Skeleton } from "@crm/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@crm/ui";

function DiffCell({ diff }: { diff: unknown }) {
  const t = useTranslations("auditLogs");
  if (diff === null || diff === undefined) {
    return <span className="text-ink-subtle">{t("noDiff")}</span>;
  }
  return (
    <div className="max-w-xs overflow-x-auto">
      <pre className="whitespace-pre text-xs text-slate-600">{JSON.stringify(diff, null, 2)}</pre>
    </div>
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
  const { locale } = useParams<{ locale: string }>();

  const [filters, setFilters] = useState<AuditLogFilters>({});
  const auditLogsQuery = useAuditLogsQuery(filters);
  const usersQuery = useUsersQuery();

  function updateFilter<K extends keyof AuditLogFilters>(key: K, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
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
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("filterAction")}
          <Input
            className="min-w-[10rem]"
            defaultValue={filters.action ?? ""}
            placeholder={t("filterActionPlaceholder")}
            onBlur={(event) => updateFilter("action", event.target.value.trim())}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("filterEntityType")}
          <Input
            className="min-w-[10rem]"
            defaultValue={filters.entityType ?? ""}
            placeholder={t("filterEntityTypePlaceholder")}
            onBlur={(event) => updateFilter("entityType", event.target.value.trim())}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("filterFrom")}
          <Input
            type="date"
            className="w-40"
            value={filters.from ?? ""}
            onChange={(event) => updateFilter("from", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("filterTo")}
          <Input
            type="date"
            className="w-40"
            value={filters.to ?? ""}
            onChange={(event) => updateFilter("to", event.target.value)}
          />
        </label>
        <Button
          variant="outline"
          size="sm"
          className="self-end"
          onClick={() => setFilters({})}
          disabled={!filters.action && !filters.entityType && !filters.from && !filters.to}
        >
          {t("filterClear")}
        </Button>
      </div>

      {auditLogsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
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

      {auditLogsQuery.isSuccess && auditLogsQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("empty")}
        </p>
      )}

      {auditLogsQuery.isSuccess && auditLogsQuery.data.length > 0 && (
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
              {auditLogsQuery.data.map((log: AuditLogSummary) => (
                <TableRow key={log.id}>
                  <TableCell className="text-slate-500">
                    {new Date(log.createdAt).toLocaleString(locale)}
                  </TableCell>
                  <TableCell>
                    <ActorCell actorId={log.actorId} nameById={actorNameById} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell className="text-slate-500">
                    {log.entityId ?? <span className="text-ink-subtle">{t("noEntityId")}</span>}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {log.branchId ?? <span className="text-ink-subtle">{t("noBranch")}</span>}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {log.ipAddress ?? <span className="text-ink-subtle">{t("noIpAddress")}</span>}
                  </TableCell>
                  <TableCell>
                    <DiffCell diff={log.diff} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
