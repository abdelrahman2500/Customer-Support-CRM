"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePermissionsQuery, useRolesQuery } from "@/hooks/use-roles";
import type { RoleSummary } from "@/lib/roles-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function RoleRow({
  role,
  expanded,
  onToggle,
}: {
  role: RoleSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("roles");
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="font-medium text-slate-900">{role.name}</TableCell>
        <TableCell className="text-slate-500">{role.permissions.length}</TableCell>
        <TableCell>
          <Button type="button" variant="outline" size="sm">
            {expanded ? t("list.collapse") : t("list.expand")}
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={3}>
            {role.permissions.length === 0 ? (
              <p className="text-sm text-slate-500">{t("list.noPermissions")}</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((permission) => (
                  <Badge key={permission} variant="outline">
                    {permission}
                  </Badge>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Story 34 — Roles & Permissions Viewer, over the already-existing `GET
 * /identity/roles`/`GET /identity/permissions` (Story 03, never before
 * consumed by any frontend). Entirely read-only — no mutation exists on
 * this screen, so expand/collapse state is tracked once here as a plain
 * `Set<string>` of expanded role ids, rather than via a per-row
 * subcomponent — there is no hook being called per row that rules-of-hooks
 * would otherwise require isolating (unlike `ContactRow`/`SlaPolicyRow`/
 * `UnclaimedTicketRow`, which each bind a real mutation to one row's id).
 * The two sections (roles, permissions reference) fetch and fail
 * independently of each other, mirroring the established multi-card
 * independent-failure convention (e.g. `CustomerDetailView`'s Contacts vs.
 * Related Tickets cards).
 */
export function RoleListView() {
  const t = useTranslations("roles");
  const rolesQuery = useRolesQuery();
  const permissionsQuery = usePermissionsQuery();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("list.rolesHeading")}</h2>

        {rolesQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {rolesQuery.isError && (
          <Alert variant="destructive" className="mt-2 flex items-center justify-between">
            <span>{t("list.error")}</span>
            <Button variant="outline" size="sm" onClick={() => rolesQuery.refetch()}>
              {t("list.retry")}
            </Button>
          </Alert>
        )}

        {rolesQuery.isSuccess && rolesQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("list.empty")}</p>
        )}

        {rolesQuery.isSuccess && rolesQuery.data.length > 0 && (
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>{t("list.columns.name")}</TableHead>
                <TableHead>{t("list.columns.permissionCount")}</TableHead>
                <TableHead>{t("list.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolesQuery.data.map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  expanded={expandedIds.has(role.id)}
                  onToggle={() => toggle(role.id)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("list.permissionsHeading")}</h2>

        {permissionsQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {permissionsQuery.isError && (
          <Alert variant="destructive" className="mt-2 flex items-center justify-between">
            <span>{t("list.permissionsError")}</span>
            <Button variant="outline" size="sm" onClick={() => permissionsQuery.refetch()}>
              {t("list.retry")}
            </Button>
          </Alert>
        )}

        {permissionsQuery.isSuccess && permissionsQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("list.permissionsEmpty")}</p>
        )}

        {permissionsQuery.isSuccess && permissionsQuery.data.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {permissionsQuery.data.map((permission) => (
              <Badge key={permission.id} variant="outline">
                {permission.key}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
