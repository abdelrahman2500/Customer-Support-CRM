"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUpdateUserMutation, useUsersQuery } from "@/hooks/use-tickets";
import type { UserSummary } from "@/lib/tickets-api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Story 32 — User Management: list, inline rename, inline
 * activate/deactivate, over the already-existing `GET`/`PATCH
 * /identity/users` (Story 03/23). Roles are read-only badges — no
 * mutation endpoint exists for role assignment. Mirrors `TicketListView`'s
 * loading/error/empty conventions and `TicketDetailView`'s never-optimistic,
 * blur-commit inline-field / actionForbidden-vs-actionFailed pattern.
 *
 * Story 38 — adds a "New user" entry point to `/users/new` (creation was
 * explicitly deferred in Story 32 pending `GET /identity/branches`/`GET
 * /identity/departments`, added by Story 35). This list itself is
 * otherwise unchanged.
 */
export function UserListView() {
  const t = useTranslations("users");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const usersQuery = useUsersQuery();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
        <Button size="sm" onClick={() => router.push(`/${locale}/users/new`)}>
          {t("list.createButton")}
        </Button>
      </div>

      {usersQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {usersQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("list.error")}</span>
          <Button variant="outline" size="sm" onClick={() => usersQuery.refetch()}>
            {t("list.retry")}
          </Button>
        </Alert>
      )}

      {usersQuery.isSuccess && usersQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("list.empty")}
        </p>
      )}

      {usersQuery.isSuccess && usersQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.columns.email")}</TableHead>
              <TableHead>{t("list.columns.fullName")}</TableHead>
              <TableHead>{t("list.columns.roles")}</TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.data.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function UserRow({ user }: { user: UserSummary }) {
  const t = useTranslations("users");
  const mutation = useUpdateUserMutation(user.id);
  const [fullNameDraft, setFullNameDraft] = useState(user.fullName);

  function commitFullName() {
    const trimmed = fullNameDraft.trim();
    if (!trimmed || trimmed === user.fullName) {
      setFullNameDraft(user.fullName);
      return;
    }
    mutation.mutate(
      { fullName: trimmed },
      { onError: () => setFullNameDraft(user.fullName) },
    );
  }

  function toggleActive() {
    mutation.mutate({ isActive: !user.isActive });
  }

  return (
    <TableRow>
      <TableCell className="text-slate-500">{user.email}</TableCell>
      <TableCell>
        <Input
          className="min-w-[10rem]"
          value={fullNameDraft}
          onChange={(event) => setFullNameDraft(event.target.value)}
          onBlur={commitFullName}
        />
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {mutation.error instanceof ApiError && mutation.error.status === 403
              ? t("list.actionForbidden")
              : t("list.actionFailed")}
          </p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 && <span className="text-slate-400">{t("list.noRoles")}</span>}
          {user.roles.map((role) => (
            <Badge key={role} variant="outline">
              {role}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={user.isActive ? "success" : "secondary"}>
            {user.isActive ? t("list.active") : t("list.inactive")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={toggleActive}
          >
            {user.isActive ? t("list.deactivate") : t("list.activate")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
