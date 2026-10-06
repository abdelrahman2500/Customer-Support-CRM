"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useDepartmentsQuery,
  useResetPasswordMutation,
  useUnlockUserMutation,
  useUpdateUserAssignmentMutation,
  useUpdateUserMutation,
  useUserListQuery,
} from "@/hooks/use-tickets";
import { useRolesQuery } from "@/hooks/use-roles";
import { useCan } from "@/lib/permissions";
import { useAgentPresence, type PresenceStatus } from "@/hooks/use-agent-presence";
import type { ListUsersFilters, UserSummary } from "@/lib/tickets-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useUrlFilters } from "@/lib/url-filters";
import {
  Avatar,
  Badge,
  Button,
  FetchingIndicator,
  FormField,
  FormSection,
  Input,
  ListToolbar,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Pagination,
  QueryStateCard,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";

/** Batch 4 (UX audit) — the URL <-> `ListUsersFilters` mapping for this
 * view's own `useUrlFilters`, mirroring `customer-list-view.tsx`'s
 * identical pair (no sort here — `GET /identity/users/paged` has none). */
function parseUserListFilters(params: URLSearchParams): ListUsersFilters {
  const page = params.get("page");
  return {
    ...(params.get("search") ? { search: params.get("search")! } : {}),
    ...(page ? { page: Number(page) } : {}),
  };
}

function serializeUserListFilters(filters: ListUsersFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  return params;
}

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
 *
 * Story 108 — Agent Presence UI. A new "Presence" column shows each
 * listed user's live online/offline status via `useAgentPresence`, the
 * first real consumer of Story 71's `agent:{id}:presence` room. `userIds`
 * is memoized off `usersQuery.data` (which TanStack Query already keeps
 * referentially stable via structural sharing across refetches) rather
 * than derived inline, so the hook's own socket effect — keyed on plain
 * reference equality, mirroring `useBranchNotifications`'s own `branchId`
 * dependency — doesn't tear down and reconnect on every unrelated
 * re-render. A user not yet reported by the socket (still connecting, or
 * the connection failed) renders as offline — the same "unknown reads as
 * the safe default" choice `isActive`'s own Badge would make if presence
 * had a genuine third state, which it doesn't.
 *
 * Story 122 — Account Lockout. A "Locked" `Badge` (the existing, previously
 * unused `"warning"` variant) plus an "Unlock" button appear in the status
 * cell only when `user.isLocked` — immediate-commit on click, no
 * `ConfirmDialog` (clearing a lock is not destructive, mirrors the
 * "activate" button's own no-confirm precedent, the inverse of
 * "deactivate"'s confirm-gated one), wired to the new
 * `useUnlockUserMutation(user.id)`.
 *
 * RM-10 — every `TableCell` below now carries a `label` matching its
 * column's own `TableHead` text, mirroring `TicketListView`'s/
 * `CustomerListView`'s identical change. This screen has no filter/search
 * bar to stack, so that half of the pattern doesn't apply here.
 *
 * Batch 4 (UX audit) — real pagination (`useUserListQuery`/`GET
 * /identity/users/paged`) replaces the old `MAX_USERS_ROWS`-capped,
 * unpaginated `useUsersQuery` this screen used, closing the Recon's P1
 * finding: a branch with more staff than the cap could never see or manage
 * its overflow. Gains the search input the previous doc comment's "no
 * filter/search bar" line explicitly disclaimed — a real, page-based list
 * needs one to be usable past page 1. Filters/page now live in the URL via
 * `useUrlFilters` (mirroring every other list view's identical Batch 4
 * change), so `UserListView` is now a thin `Suspense` wrapper around
 * `UserListViewContent`.
 */
export function UserListView() {
  return (
    <Suspense fallback={null}>
      <UserListViewContent />
    </Suspense>
  );
}

function UserListViewContent() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();

  const [filters, setFilters] = useUrlFilters(parseUserListFilters, serializeUserListFilters);
  const usersQuery = useUserListQuery(filters);
  const page = usersQuery.data;
  const users = page?.items;

  const userIds = useMemo(() => (users ?? []).map((user) => user.id), [users]);
  const presence = useAgentPresence(userIds);

  function updateSearch(value: string) {
    setFilters((current) => ({ ...current, search: value || undefined, page: undefined }));
  }

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title={t("list.title")}
        actions={
          <>
            <FetchingIndicator active={usersQuery.isPlaceholderData} label={tCommon("updating")} />
            <Button size="sm" asChild>
              <Link href={`/${locale}/users/new`}>{t("list.createButton")}</Link>
            </Button>
          </>
        }
      />

      {/* Story 226 (PR-4.5) — the shared toolbar: the same blur/Enter search. */}
      <ListToolbar
        search={{
          value: filters.search ?? "",
          onCommit: (value) => updateSearch(value.trim()),
          label: t("list.searchLabel"),
          placeholder: t("list.searchPlaceholder"),
          clearLabel: t("list.clearSearch"),
        }}
        summary={page ? t("list.summary", { count: page.total }) : undefined}
      />

      <QueryStateCard
        isLoading={usersQuery.isPending}
        isError={usersQuery.isError && users === undefined}
        isEmpty={users !== undefined && users.length === 0}
        isFiltered={Boolean(filters.search)}
        loadingLabel={tCommon("loading")}
        loadingPlaceholder={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        }
        error={{
          title: t("list.error"),
          retryLabel: t("list.retry"),
          onRetry: () => void usersQuery.refetch(),
        }}
        backgroundError={
          usersQuery.isError && users !== undefined
            ? {
                title: t("list.error"),
                retryLabel: t("list.retry"),
                onRetry: () => void usersQuery.refetch(),
              }
            : undefined
        }
        empty={{ title: t("list.empty") }}
        noResults={{ title: t("list.noResults") }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.columns.email")}</TableHead>
              <TableHead>{t("list.columns.fullName")}</TableHead>
              <TableHead>{t("list.columns.roles")}</TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
              <TableHead>{t("list.columns.presence")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("list.columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).map((user) => (
              <UserRow key={user.id} user={user} presence={presence[user.id]} />
            ))}
          </TableBody>
        </Table>
      </QueryStateCard>

      {page !== undefined && (
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          onPageChange={(next) => setFilters((current) => ({ ...current, page: next }))}
          disabled={usersQuery.isPlaceholderData}
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

function UserRow({ user, presence }: { user: UserSummary; presence: PresenceStatus | undefined }) {
  const t = useTranslations("users");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateUserMutation(user.id);
  const assignmentMutation = useUpdateUserAssignmentMutation(user.id);
  const resetPasswordMutation = useResetPasswordMutation(user.id);
  const unlockMutation = useUnlockUserMutation(user.id);
  // Demo hardening — without `role:read` (an agent) the request would
  // only 403, once per row.
  const rolesQuery = useRolesQuery({ enabled: useCan("role:read") });
  const departmentsQuery = useDepartmentsQuery();
  const [fullNameDraft, setFullNameDraft] = useState(user.fullName);
  const [emailDraft, setEmailDraft] = useState(user.email);
  const [newPasswordDraft, setNewPasswordDraft] = useState("");
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);
  // Story 94 — deactivating a user and resetting their password are both
  // genuinely destructive/hard-to-undo (a deactivated user can no longer
  // sign in; a reset password immediately invalidates the old one) — both
  // now require an explicit confirmation step before the existing mutation
  // fires. Activating a user is not destructive and stays immediate.
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  function commitFullName() {
    const trimmed = fullNameDraft.trim();
    if (!trimmed || trimmed === user.fullName) {
      setFullNameDraft(user.fullName);
      return;
    }
    mutation.mutate({ fullName: trimmed }, { onError: () => setFullNameDraft(user.fullName) });
  }

  function commitEmail() {
    const trimmed = emailDraft.trim();
    if (!trimmed || trimmed === user.email) {
      setEmailDraft(user.email);
      return;
    }
    mutation.mutate({ email: trimmed }, { onError: () => setEmailDraft(user.email) });
  }

  function handleToggleActiveClick() {
    if (user.isActive) {
      setConfirmDeactivateOpen(true);
      return;
    }
    mutation.mutate({ isActive: true });
  }

  function confirmDeactivate() {
    mutation.mutate({ isActive: false }, { onSuccess: () => setConfirmDeactivateOpen(false) });
  }

  function confirmResetPassword() {
    // Feedback for this one stays the existing inline green confirmation
    // line (below) rather than also firing a toast — it already gives
    // clear, non-silent success feedback, unlike the mutations this story's
    // toast wiring specifically targets (Recon: "the existing UX currently
    // goes silent").
    resetPasswordMutation.mutate(
      { newPassword: newPasswordDraft },
      {
        onSuccess: () => {
          setNewPasswordDraft("");
          setPasswordResetSuccess(true);
          setConfirmResetOpen(false);
        },
      },
    );
  }

  const roleName = (rolesQuery.data ?? []).find((role) => role.id === user.roleId)?.name;
  const departmentName = user.departmentId
    ? (departmentsQuery.data ?? []).find((department) => department.id === user.departmentId)?.name
    : undefined;

  // Story 226 (PR-4.5) — the row reads; the Sheet edits. Every control and
  // mutation below is the one the row used to hold, moved as is.
  return (
    <TableRow>
      <TableCell label={t("list.columns.email")}>
        <span dir="ltr" className="break-all text-ink">
          {user.email}
        </span>
      </TableCell>
      <TableCell label={t("list.columns.fullName")}>
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={user.fullName} size="sm" presence={presence} decorative />
          <span className="min-w-0 font-medium text-ink">{user.fullName}</span>
        </span>
      </TableCell>
      <TableCell label={t("list.columns.roles")}>
        <span className="flex flex-col">
          <span className="text-ink">{roleName ?? "—"}</span>
          <span className="text-caption text-ink-subtle">
            {departmentName ?? t("list.noDepartment")}
          </span>
        </span>
      </TableCell>
      <TableCell label={t("list.columns.status")}>
        <span className="flex flex-wrap items-center gap-1">
          <Badge variant={user.isActive ? "success" : "secondary"}>
            {user.isActive ? t("list.active") : t("list.inactive")}
          </Badge>
          {user.isLocked && <Badge variant="warning">{t("list.locked")}</Badge>}
        </span>
      </TableCell>
      <TableCell label={t("list.columns.presence")}>
        <Badge variant={presence === "online" ? "success" : "secondary"}>
          {presence === "online" ? t("list.online") : t("list.offline")}
        </Badge>
      </TableCell>
      <TableCell className="text-end">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <span aria-hidden="true">{t("list.edit")}</span>
              <span className="sr-only">{t("list.editUser", { name: user.fullName })}</span>
            </Button>
          </SheetTrigger>
          <SheetContent size="md" closeLabel={t("list.closeEditor")} aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>{t("list.editUser", { name: user.fullName })}</SheetTitle>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-section">
              <FormSection title={t("list.sectionDetails")}>
                <FormField label={t("list.columns.email")} density="comfortable">
                  <Input
                    type="email"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    onBlur={commitEmail}
                  />
                </FormField>
                <FormField label={t("list.columns.fullName")} density="comfortable">
                  <Input
                    value={fullNameDraft}
                    onChange={(event) => setFullNameDraft(event.target.value)}
                    onBlur={commitFullName}
                  />
                </FormField>
                {mutation.isError && (
                  <p role="alert" className="text-xs text-danger-foreground">
                    {errorMessage(mutation.error, {
                      forbidden: t("list.actionForbidden"),
                      generic: t("list.actionFailed"),
                    })}
                  </p>
                )}
              </FormSection>

              <FormSection title={t("list.sectionAccess")}>
                <FormField
                  label={t("list.roleLabel")}
                  density="comfortable"
                  hint={rolesQuery.isLoading ? t("list.optionsLoading") : undefined}
                  error={rolesQuery.isError ? t("list.roleLoadError") : undefined}
                >
                  <Select
                    value={user.roleId}
                    disabled={assignmentMutation.isPending || rolesQuery.isLoading}
                    onValueChange={(value) => assignmentMutation.mutate({ roleId: value })}
                  >
                    <SelectTrigger aria-label={t("list.roleLabel")}>
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
                </FormField>
                <FormField
                  label={t("list.departmentLabel")}
                  density="comfortable"
                  hint={departmentsQuery.isLoading ? t("list.optionsLoading") : undefined}
                  error={departmentsQuery.isError ? t("list.departmentLoadError") : undefined}
                >
                  <Select
                    value={user.departmentId ?? UNSET_DEPARTMENT}
                    disabled={assignmentMutation.isPending || departmentsQuery.isLoading}
                    onValueChange={(value) =>
                      assignmentMutation.mutate({
                        departmentId: value === UNSET_DEPARTMENT ? null : value,
                      })
                    }
                  >
                    <SelectTrigger aria-label={t("list.departmentLabel")}>
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
                </FormField>
                {assignmentMutation.isError && (
                  <p role="alert" className="text-xs text-danger-foreground">
                    {errorMessage(assignmentMutation.error, {
                      forbidden: t("list.actionForbidden"),
                      generic: t("list.actionFailed"),
                    })}
                  </p>
                )}
              </FormSection>

              <FormSection title={t("list.passwordResetLabel")}>
                <FormField label={t("list.passwordResetLabel")} density="comfortable">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("list.passwordResetPlaceholder")}
                    value={newPasswordDraft}
                    onChange={(event) => {
                      setNewPasswordDraft(event.target.value);
                      setPasswordResetSuccess(false);
                    }}
                  />
                </FormField>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Story 98 — destructive, like its own confirmation. */}
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={newPasswordDraft.length < 8 || resetPasswordMutation.isPending}
                    onClick={() => setConfirmResetOpen(true)}
                  >
                    {resetPasswordMutation.isPending
                      ? t("list.passwordResetSubmitting")
                      : t("list.passwordResetSubmit")}
                  </Button>
                  <ConfirmDialog
                    open={confirmResetOpen}
                    onOpenChange={setConfirmResetOpen}
                    title={t("list.passwordResetConfirmTitle")}
                    description={t("list.passwordResetConfirmDescription")}
                    confirmLabel={t("list.passwordResetSubmit")}
                    onConfirm={confirmResetPassword}
                    isPending={resetPasswordMutation.isPending}
                  />
                </div>
                {passwordResetSuccess && (
                  <p className="text-xs text-success-foreground">
                    {t("list.passwordResetSuccess")}
                  </p>
                )}
                {resetPasswordMutation.isError && (
                  <p role="alert" className="text-xs text-danger-foreground">
                    {errorMessage(resetPasswordMutation.error, {
                      forbidden: t("list.actionForbidden"),
                      generic: t("list.actionFailed"),
                    })}
                  </p>
                )}
              </FormSection>

              <FormSection title={t("list.sectionStatus")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={user.isActive ? "success" : "secondary"}>
                    {user.isActive ? t("list.active") : t("list.inactive")}
                  </Badge>
                  <Button
                    variant={user.isActive ? "destructive" : "outline"}
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={handleToggleActiveClick}
                  >
                    {user.isActive ? t("list.deactivate") : t("list.activate")}
                  </Button>
                  <ConfirmDialog
                    open={confirmDeactivateOpen}
                    onOpenChange={setConfirmDeactivateOpen}
                    title={t("list.deactivateConfirmTitle")}
                    description={t("list.deactivateConfirmDescription", { name: user.fullName })}
                    confirmLabel={t("list.deactivate")}
                    onConfirm={confirmDeactivate}
                    isPending={mutation.isPending}
                  />
                </div>
                {user.isLocked && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{t("list.locked")}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={unlockMutation.isPending}
                      onClick={() => unlockMutation.mutate()}
                    >
                      {t("list.unlock")}
                    </Button>
                  </div>
                )}
                {unlockMutation.isError && (
                  <p role="alert" className="text-xs text-danger-foreground">
                    {errorMessage(unlockMutation.error, {
                      forbidden: t("list.actionForbidden"),
                      generic: t("list.actionFailed"),
                    })}
                  </p>
                )}
              </FormSection>
            </SheetBody>
          </SheetContent>
        </Sheet>
      </TableCell>
    </TableRow>
  );
}
