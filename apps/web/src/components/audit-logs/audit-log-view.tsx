"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuditLogsQuery } from "@/hooks/use-audit-logs";
import { useUsersQuery } from "@/hooks/use-tickets";
import type { AuditLogSummary } from "@/lib/audit-logs-api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function DiffCell({ diff }: { diff: unknown }) {
  const t = useTranslations("auditLogs");
  if (diff === null || diff === undefined) {
    return <span className="text-slate-400">{t("noDiff")}</span>;
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
function ActorCell({ actorId, nameById }: { actorId: string | null; nameById: Map<string, string> }) {
  const t = useTranslations("auditLogs");
  if (!actorId) {
    return <span className="text-slate-400">{t("systemActor")}</span>;
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
 */
export function AuditLogView() {
  const t = useTranslations("auditLogs");
  const { locale } = useParams<{ locale: string }>();

  const auditLogsQuery = useAuditLogsQuery();
  const usersQuery = useUsersQuery();

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

      {auditLogsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {auditLogsQuery.isError && forbidden && (
        <Alert variant="destructive">{t("forbidden")}</Alert>
      )}

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
                    {log.entityId ?? <span className="text-slate-400">{t("noEntityId")}</span>}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {log.branchId ?? <span className="text-slate-400">{t("noBranch")}</span>}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {log.ipAddress ?? <span className="text-slate-400">{t("noIpAddress")}</span>}
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
