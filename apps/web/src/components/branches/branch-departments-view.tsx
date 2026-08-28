"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateDepartmentMutation,
  useManagedBranchQuery,
  useManagedDepartmentsQuery,
  useUpdateBranchMutation,
  useUpdateDepartmentMutation,
} from "@/hooks/use-branches";
import type { ManagedBranch, ManagedDepartment } from "@/lib/branches-api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Story 45 — Branch & Department Management: a single combined screen, the
 * same "parent record header + child list section" shape
 * `BusinessHoursView` already established (calendar header above, exceptions
 * list below) — here, the caller's own branch above, its departments below.
 *
 * `ManagedBranch` never carries a `timezone` (the GET endpoint doesn't
 * return one — see `branches-api.ts`), so this view only ever exposes
 * rename + activate/deactivate for the branch, never a timezone field.
 */
export function BranchDepartmentsView() {
  return (
    <section className="flex flex-col gap-6">
      <MyBranchSection />
      <DepartmentsSection />
    </section>
  );
}

function MyBranchSection() {
  const t = useTranslations("branches");
  const branchQuery = useManagedBranchQuery();

  if (branchQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (branchQuery.isError) {
    return (
      <Alert variant="destructive" className="flex items-center justify-between">
        <span>{t("myBranch.loadError")}</span>
        <Button variant="outline" size="sm" onClick={() => branchQuery.refetch()}>
          {t("myBranch.retry")}
        </Button>
      </Alert>
    );
  }

  const branch = branchQuery.data;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("myBranch.heading")}</h1>
      {branch ? (
        <MyBranchFields branch={branch} />
      ) : (
        <p className="mt-2 text-sm text-slate-500">{t("myBranch.loadError")}</p>
      )}
    </div>
  );
}

/**
 * The caller's own branch's editable fields — a dedicated component (not
 * inline in `MyBranchSection`) so `useUpdateBranchMutation` is called
 * exactly once, bound to the one real branch id in scope, mirroring
 * `SlaPolicyRow`/`UserRow`'s Rules-of-Hooks convention even though there is
 * only ever a single row here.
 */
function MyBranchFields({ branch }: { branch: ManagedBranch }) {
  const t = useTranslations("branches");
  const mutation = useUpdateBranchMutation(branch.id);
  const [nameDraft, setNameDraft] = useState(branch.name);

  function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === branch.name) {
      setNameDraft(branch.name);
      return;
    }
    mutation.mutate({ name: trimmed }, { onError: () => setNameDraft(branch.name) });
  }

  function toggleActive() {
    mutation.mutate({ isActive: !branch.isActive });
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="flex max-w-sm flex-col gap-1 text-sm text-slate-700">
        {t("myBranch.nameLabel")}
        <Input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
        />
      </label>
      <div className="flex items-center gap-2">
        <Badge variant={branch.isActive ? "success" : "secondary"}>
          {branch.isActive ? t("myBranch.active") : t("myBranch.inactive")}
        </Badge>
        <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={toggleActive}>
          {branch.isActive ? t("myBranch.deactivate") : t("myBranch.activate")}
        </Button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-red-600">
          {mutation.error instanceof ApiError && mutation.error.status === 403
            ? t("myBranch.actionForbidden")
            : t("myBranch.actionFailed")}
        </p>
      )}
    </div>
  );
}

function DepartmentsSection() {
  const t = useTranslations("branches");
  const departmentsQuery = useManagedDepartmentsQuery();

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("departments.heading")}</h2>

      {departmentsQuery.isLoading && (
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {departmentsQuery.isError && (
        <Alert variant="destructive" className="mt-2 flex items-center justify-between">
          <span>{t("departments.error")}</span>
          <Button variant="outline" size="sm" onClick={() => departmentsQuery.refetch()}>
            {t("departments.retry")}
          </Button>
        </Alert>
      )}

      {departmentsQuery.isSuccess && departmentsQuery.data.length === 0 && (
        <p className="mt-2 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("departments.empty")}
        </p>
      )}

      {departmentsQuery.isSuccess && departmentsQuery.data.length > 0 && (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>{t("departments.columns.name")}</TableHead>
              <TableHead>{t("departments.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departmentsQuery.data.map((department) => (
              <DepartmentRow key={department.id} department={department} />
            ))}
          </TableBody>
        </Table>
      )}

      <AddDepartmentForm />
    </div>
  );
}

/**
 * One existing department's row — a dedicated component (not inline in a
 * `.map()`) because `useUpdateDepartmentMutation` is a hook and must be
 * called once per component instance, not once per loop iteration (React's
 * rules of hooks — the same constraint `SlaPolicyRow`/`UserRow` already
 * established elsewhere in this codebase).
 */
function DepartmentRow({ department }: { department: ManagedDepartment }) {
  const t = useTranslations("branches");
  const mutation = useUpdateDepartmentMutation(department.id);
  const [nameDraft, setNameDraft] = useState(department.name);

  function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === department.name) {
      setNameDraft(department.name);
      return;
    }
    mutation.mutate({ name: trimmed }, { onError: () => setNameDraft(department.name) });
  }

  function toggleActive() {
    mutation.mutate({ isActive: !department.isActive });
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          className="min-w-[10rem]"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
        />
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {mutation.error instanceof ApiError && mutation.error.status === 403
              ? t("departments.actionForbidden")
              : t("departments.actionFailed")}
          </p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={department.isActive ? "success" : "secondary"}>
            {department.isActive ? t("departments.active") : t("departments.inactive")}
          </Badge>
          <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={toggleActive}>
            {department.isActive ? t("departments.deactivate") : t("departments.activate")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * The smallest UI surface for a one-field create — an inline form below the
 * table, not a separate route/page, mirroring `CreateUserView`'s
 * submit/error-handling pattern but inline rather than a full page.
 */
function AddDepartmentForm() {
  const t = useTranslations("branches");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateDepartmentMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ name: name.trim() });
      setName("");
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("departments.createFailed"));
    }
  }

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("departments.nameLabel")}
        <Input
          value={name}
          placeholder={t("departments.createPlaceholder")}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={1}
          className="w-56"
        />
      </label>
      <Button type="submit" size="sm" disabled={mutation.isPending || !name.trim()}>
        {mutation.isPending ? t("departments.createSubmitting") : t("departments.createSubmit")}
      </Button>
      {error && (
        <Alert variant="destructive" className="w-full">
          {error}
        </Alert>
      )}
    </form>
  );
}
