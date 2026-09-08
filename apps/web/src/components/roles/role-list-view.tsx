"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateRoleMutation,
  useManagedRolesQuery,
  usePermissionsQuery,
  useSetRolePermissionsMutation,
  useUpdateRoleMutation,
} from "@/hooks/use-roles";
import type { PermissionSummary, RoleSummary } from "@/lib/roles-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  QueryStateCard,
  showSuccessToast,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";

/** The two seeded roles `seed.ts` reconciles by literal name — the backend
 * rejects a rename/deactivate on either (Design item 5); this is a
 * client-side courtesy only, the backend remains the actual source of truth. */
const PROTECTED_ROLE_NAMES = new Set(["SuperAdmin", "Agent"]);

function RoleRow({
  role,
  expanded,
  onToggle,
  allPermissions,
}: {
  role: RoleSummary;
  expanded: boolean;
  onToggle: () => void;
  allPermissions: PermissionSummary[];
}) {
  const t = useTranslations("roles");
  const errorMessage = useErrorMessage();
  const updateMutation = useUpdateRoleMutation(role.id);
  const permissionsMutation = useSetRolePermissionsMutation(role.id);
  const [nameDraft, setNameDraft] = useState(role.name);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const isProtected = PROTECTED_ROLE_NAMES.has(role.name);

  function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === role.name) {
      setNameDraft(role.name);
      return;
    }
    updateMutation.mutate({ name: trimmed }, { onError: () => setNameDraft(role.name) });
  }

  function handleToggleActiveClick() {
    if (role.isActive) {
      setConfirmDeactivateOpen(true);
      return;
    }
    updateMutation.mutate({ isActive: true });
  }

  function confirmDeactivate() {
    updateMutation.mutate(
      { isActive: false },
      { onSuccess: () => setConfirmDeactivateOpen(false) },
    );
  }

  function changeVisibilityScope(value: string) {
    updateMutation.mutate({ ticketVisibilityScope: value as RoleSummary["ticketVisibilityScope"] });
  }

  function togglePermission(permissionKey: string) {
    const next = role.permissions.includes(permissionKey)
      ? role.permissions.filter((key) => key !== permissionKey)
      : [...role.permissions, permissionKey];
    permissionsMutation.mutate({ permissionKeys: next });
  }

  const activeError = updateMutation.isError ? updateMutation.error : permissionsMutation.error;
  const hasError = updateMutation.isError || permissionsMutation.isError;

  return (
    <>
      <TableRow>
        <TableCell className="font-medium text-slate-900">
          {isProtected ? (
            <div className="flex items-center gap-2">
              <span>{role.name}</span>
              <Badge variant="outline">{t("list.systemRole")}</Badge>
            </div>
          ) : (
            <Input
              className="min-w-[10rem]"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={commitName}
            />
          )}
        </TableCell>
        <TableCell className="text-slate-500">{role.permissions.length}</TableCell>
        <TableCell>
          <Select value={role.ticketVisibilityScope} onValueChange={changeVisibilityScope}>
            <SelectTrigger className="w-40" aria-label={t("list.columns.visibility")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BRANCH">{t("list.visibilityBranch")}</SelectItem>
              <SelectItem value="DEPARTMENT">{t("list.visibilityDepartment")}</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            {!isProtected && (
              <>
                <Badge variant={role.isActive ? "success" : "secondary"}>
                  {role.isActive ? t("list.active") : t("list.inactive")}
                </Badge>
                <Button
                  type="button"
                  variant={role.isActive ? "destructive" : "outline"}
                  size="sm"
                  disabled={updateMutation.isPending}
                  onClick={handleToggleActiveClick}
                >
                  {role.isActive ? t("list.deactivate") : t("list.activate")}
                </Button>
                <ConfirmDialog
                  open={confirmDeactivateOpen}
                  onOpenChange={setConfirmDeactivateOpen}
                  title={t("list.deactivateConfirmTitle")}
                  description={t("list.deactivateConfirmDescription", { name: role.name })}
                  confirmLabel={t("list.deactivate")}
                  onConfirm={confirmDeactivate}
                  isPending={updateMutation.isPending}
                />
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onToggle}>
              {expanded ? t("list.collapse") : t("list.expand")}
            </Button>
          </div>
          {hasError && (
            <p className="mt-1 text-xs text-red-600">
              {errorMessage(activeError, {
                forbidden: t("list.actionForbidden"),
                generic: t("list.actionFailed"),
              })}
            </p>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4}>
            <h3 className="text-xs font-semibold text-slate-700">
              {t("list.permissionsAssignHeading")}
            </h3>
            {allPermissions.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">{t("list.noPermissions")}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-3">
                {allPermissions.map((permission) => (
                  // Batch 6 (UX audit) — the shared `Checkbox`/`Label` pair
                  // (mirrors `ChatComposer`'s "send by email" checkbox),
                  // replacing a raw `<input type="checkbox">` with no
                  // focus-ring/keyboard parity with the rest of the app.
                  <div key={permission.id} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`permission-${role.id}-${permission.id}`}
                      checked={role.permissions.includes(permission.key)}
                      onCheckedChange={() => togglePermission(permission.key)}
                    />
                    <Label
                      htmlFor={`permission-${role.id}-${permission.id}`}
                      className="text-sm font-normal text-slate-700"
                    >
                      {permission.key}
                    </Label>
                  </div>
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
 * The smallest UI surface for a one-field create — an inline form below the
 * table, not a separate route/page, mirroring `AddDepartmentForm`'s exact
 * shape (Design item 13).
 */
function AddRoleForm() {
  const t = useTranslations("roles");
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateRoleMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ name: name.trim() });
      setName("");
      showSuccessToast(t("list.createSuccess", { name: name.trim() }));
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("list.actionForbidden"),
          generic: t("list.createFailed"),
        }),
      );
    }
  }

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("list.createHeading")}
        <Input
          value={name}
          placeholder={t("list.createPlaceholder")}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={1}
          className="w-56"
        />
      </label>
      <Button type="submit" size="sm" disabled={mutation.isPending || !name.trim()}>
        {mutation.isPending ? t("list.createSubmitting") : t("list.createSubmit")}
      </Button>
      {error && (
        <Alert variant="destructive" className="w-full">
          {error}
        </Alert>
      )}
    </form>
  );
}

/**
 * Story 34 — Roles & Permissions Viewer, extended in place by Story 46 into a
 * full management screen: rename/activate-deactivate (skipped for the two
 * protected roles, `SuperAdmin`/`Agent`), permission-checkbox assignment
 * against the full catalog, and a "create role" inline form. The two
 * sections (roles, permissions reference) still fetch and fail independently
 * of each other, mirroring the established multi-card independent-failure
 * convention (e.g. `CustomerDetailView`'s Contacts vs. Related Tickets
 * cards). `usePermissionsQuery()` is lifted once here and passed down to
 * every `RoleRow` as `allPermissions`, so the full catalog is fetched exactly
 * once and reused both for the per-role checkbox list and for the
 * independent "all permissions" reference section below.
 */
export function RoleListView() {
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const rolesQuery = useManagedRolesQuery();
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

  const allPermissions = permissionsQuery.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("list.rolesHeading")}</h2>

        {/* Batch 6 (UX audit) — the shared `QueryStateCard`, replacing a
            hand-rolled loading/error/empty ladder whose empty branch was a
            third, borderless variant distinct from both `EmptyState`'s
            dashed block and every other hand-rolled one in this codebase. */}
        <QueryStateCard
          className="mt-2"
          isLoading={rolesQuery.isLoading}
          isError={rolesQuery.isError}
          isEmpty={rolesQuery.isSuccess && rolesQuery.data.length === 0}
          loadingLabel={tCommon("loading")}
          loadingPlaceholder={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          }
          error={{
            title: t("list.error"),
            retryLabel: t("list.retry"),
            onRetry: () => void rolesQuery.refetch(),
          }}
          empty={{ title: t("list.empty") }}
        >
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>{t("list.columns.name")}</TableHead>
                <TableHead>{t("list.columns.permissionCount")}</TableHead>
                <TableHead>{t("list.columns.visibility")}</TableHead>
                <TableHead>{t("list.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rolesQuery.data ?? []).map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  expanded={expandedIds.has(role.id)}
                  onToggle={() => toggle(role.id)}
                  allPermissions={allPermissions}
                />
              ))}
            </TableBody>
          </Table>
        </QueryStateCard>

        <AddRoleForm />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("list.permissionsHeading")}</h2>

        <QueryStateCard
          className="mt-2"
          isLoading={permissionsQuery.isLoading}
          isError={permissionsQuery.isError}
          isEmpty={permissionsQuery.isSuccess && permissionsQuery.data.length === 0}
          loadingLabel={tCommon("loading")}
          loadingPlaceholder={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          }
          error={{
            title: t("list.permissionsError"),
            retryLabel: t("list.retry"),
            onRetry: () => void permissionsQuery.refetch(),
          }}
          empty={{ title: t("list.permissionsEmpty") }}
        >
          <div className="flex flex-wrap gap-1">
            {(permissionsQuery.data ?? []).map((permission) => (
              <Badge key={permission.id} variant="outline">
                {permission.key}
              </Badge>
            ))}
          </div>
        </QueryStateCard>
      </div>
    </section>
  );
}
