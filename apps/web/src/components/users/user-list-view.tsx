"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useDepartmentsQuery,
  useResetPasswordMutation,
  useUpdateUserAssignmentMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useRolesQuery } from "@/hooks/use-roles";
import type { UserSummary } from "@/lib/tickets-api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Same sentinel string `CreateUserView` uses for its own optional
 * department picker — kept as an equivalent local constant since
 * `CreateUserView` doesn't export one. */
const UNSET_DEPARTMENT = "__unset__";

/**
 * Story 32 — User Management: list, inline rename, inline
 * activate/deactivate, over the already-existing `GET`/`PATCH
 * /identity/users` (Story 03/23). Mirrors `TicketListView`'s
 * loading/error/empty conventions and `TicketDetailView`'s never-optimistic,
 * blur-commit inline-field / actionForbidden-vs-actionFailed pattern.
 *
 * Story 38 — adds a "New user" entry point to `/users/new` (creation was
 * explicitly deferred in Story 32 pending `GET /identity/branches`/`GET
 * /identity/departments`, added by Story 35). This list itself is
 * otherwise unchanged.
 *
 * Story 47 — the previously read-only `roles: string[]` badge list is
 * replaced by two inline `Select`s (role, department) that commit
 * immediately on change via the new, separate
 * `useUpdateUserAssignmentMutation(user.id)` — mirroring the existing
 * activate/deactivate button's immediate-commit-on-click convention (a
 * `Select` has no natural "blur to confirm" moment) rather than the
 * blur-commit text-input pattern. Error rendering extends the existing
 * 403-vs-generic split into `RoleListView`'s 3-way
 * 403/other-`ApiError`-verbatim/generic pattern. No branch picker — Branch
 * reassignment is out of scope (plan Design item 2).
 *
 * Story 48 — the previously plain-text email `TableCell` becomes a
 * blur-commit `Input`, identical in shape to the existing `fullName` field,
 * reusing the same, now-widened `mutation` (`useUpdateUserMutation`) —
 * its own error block extends the fullName field's 2-way split into the
 * 3-way 403/other-`ApiError`-verbatim/generic pattern Story 47 established,
 * since a duplicate-email conflict (409) needs its backend message shown
 * verbatim. Below it, a password-reset `Input` + "Reset password" `Button`
 * (disabled until 8+ characters), wired to a new, separate
 * `useResetPasswordMutation(user.id)` — commits on click (not blur), clears
 * on success, and shows a brief inline confirmation. No dialog — this
 * codebase has no modal primitive (plan Design item 6).
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
  const assignmentMutation = useUpdateUserAssignmentMutation(user.id);
  const resetPasswordMutation = useResetPasswordMutation(user.id);
  const rolesQuery = useRolesQuery();
  const departmentsQuery = useDepartmentsQuery();
  const [fullNameDraft, setFullNameDraft] = useState(user.fullName);
  const [emailDraft, setEmailDraft] = useState(user.email);
  const [newPasswordDraft, setNewPasswordDraft] = useState("");
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

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

  function commitEmail() {
    const trimmed = emailDraft.trim();
    if (!trimmed || trimmed === user.email) {
      setEmailDraft(user.email);
      return;
    }
    mutation.mutate(
      { email: trimmed },
      { onError: () => setEmailDraft(user.email) },
    );
  }

  function toggleActive() {
    mutation.mutate({ isActive: !user.isActive });
  }

  function handleResetPassword() {
    resetPasswordMutation.mutate(
      { newPassword: newPasswordDraft },
      {
        onSuccess: () => {
          setNewPasswordDraft("");
          setPasswordResetSuccess(true);
        },
      },
    );
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Input
            className="min-w-[10rem]"
            type="email"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            onBlur={commitEmail}
          />
          {mutation.isError && (
            <p className="text-xs text-red-600">
              {mutation.error instanceof ApiError && mutation.error.status === 403
                ? t("list.actionForbidden")
                : mutation.error instanceof ApiError
                  ? mutation.error.message
                  : t("list.actionFailed")}
            </p>
          )}

          <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
            <span className="text-xs text-slate-500">{t("list.passwordResetLabel")}</span>
            <Input
              className="min-w-[10rem]"
              type="password"
              placeholder={t("list.passwordResetPlaceholder")}
              value={newPasswordDraft}
              onChange={(event) => {
                setNewPasswordDraft(event.target.value);
                setPasswordResetSuccess(false);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={newPasswordDraft.length < 8 || resetPasswordMutation.isPending}
              onClick={handleResetPassword}
            >
              {resetPasswordMutation.isPending
                ? t("list.passwordResetSubmitting")
                : t("list.passwordResetSubmit")}
            </Button>
            {passwordResetSuccess && (
              <p className="text-xs text-emerald-600">{t("list.passwordResetSuccess")}</p>
            )}
            {resetPasswordMutation.isError && (
              <p className="text-xs text-red-600">
                {resetPasswordMutation.error instanceof ApiError &&
                resetPasswordMutation.error.status === 403
                  ? t("list.actionForbidden")
                  : resetPasswordMutation.error instanceof ApiError
                    ? resetPasswordMutation.error.message
                    : t("list.actionFailed")}
              </p>
            )}
          </div>
        </div>
      </TableCell>
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
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t("list.roleLabel")}</span>
            <Select
              value={user.roleId}
              disabled={assignmentMutation.isPending}
              onValueChange={(value) => assignmentMutation.mutate({ roleId: value })}
            >
              <SelectTrigger className="min-w-[10rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(rolesQuery.data ?? []).map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rolesQuery.isError && (
              <span className="text-xs text-red-600">{t("list.roleLoadError")}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t("list.departmentLabel")}</span>
            <Select
              value={user.departmentId ?? UNSET_DEPARTMENT}
              disabled={assignmentMutation.isPending}
              onValueChange={(value) =>
                assignmentMutation.mutate({
                  departmentId: value === UNSET_DEPARTMENT ? null : value,
                })
              }
            >
              <SelectTrigger className="min-w-[10rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET_DEPARTMENT}>{t("list.noDepartment")}</SelectItem>
                {(departmentsQuery.data ?? []).map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departmentsQuery.isError && (
              <span className="text-xs text-red-600">{t("list.departmentLoadError")}</span>
            )}
          </div>

          {assignmentMutation.isError && (
            <p className="text-xs text-red-600">
              {assignmentMutation.error instanceof ApiError && assignmentMutation.error.status === 403
                ? t("list.actionForbidden")
                : assignmentMutation.error instanceof ApiError
                  ? assignmentMutation.error.message
                  : t("list.actionFailed")}
            </p>
          )}
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
