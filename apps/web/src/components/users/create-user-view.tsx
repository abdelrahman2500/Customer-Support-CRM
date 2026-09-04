"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useBranchesQuery, useCreateUserMutation, useDepartmentsQuery } from "@/hooks/use-tickets";
import { useRolesQuery } from "@/hooks/use-roles";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Button, Input, showSuccessToast } from "@crm/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";

const UNSET_DEPARTMENT = "__unset__";

/**
 * Story 38 — Create User, over the already-existing `POST /identity/users`
 * (Story 03) — never previously consumed because no endpoint existed to
 * populate a valid `branchId`/`departmentId` picker (Story 32's own
 * documented deferral reason). `GET /identity/branches`/`GET
 * /identity/departments` (Story 35) resolve that; the role picker reuses
 * the existing `useRolesQuery` (`@/hooks/use-roles`, Story 34) rather than
 * duplicating it here.
 *
 * Mirrors `CreateTicketView`'s exact shape: plain `useState` (no form/
 * validation library), an `UNSET_DEPARTMENT` sentinel for the optional
 * `departmentId` (mirroring `CreateTicketView`'s own `UNSET_PRIORITY`),
 * never optimistic (`mutateAsync` + real error rendering), and navigation
 * to the real, already-existing `/users` list on success — the same
 * "navigate to the real resulting record" convention `CreateTicketView`
 * already established (there, the new ticket's own detail page; here, the
 * list the new user will appear in once its own query is invalidated).
 */
export function CreateUserView() {
  const t = useTranslations("users");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState<string>(UNSET_DEPARTMENT);
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const branchesQuery = useBranchesQuery();
  const departmentsQuery = useDepartmentsQuery();
  const rolesQuery = useRolesQuery();
  const mutation = useCreateUserMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      await mutation.mutateAsync({
        email,
        password,
        fullName,
        branchId,
        roleId,
        ...(departmentId !== UNSET_DEPARTMENT ? { departmentId } : {}),
      });
      showSuccessToast(t("create.createSuccess", { name: fullName.trim() }));
      router.push(`/${locale}/users`);
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("create.actionForbidden"),
          generic: t("create.createFailed"),
        }),
      );
    }
  }

  return (
    <section className="flex max-w-md flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("create.title")}</h1>

      {error && <Alert variant="destructive">{error}</Alert>}

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.email")}
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.password")}
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <span className="text-xs text-slate-500">{t("create.passwordHint")}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.fullName")}
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            minLength={1}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.branch")}
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger>
              <SelectValue placeholder={t("create.selectBranch")} />
            </SelectTrigger>
            <SelectContent>
              {(branchesQuery.data ?? []).map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branchesQuery.isError && (
            <span className="text-xs text-red-600">{t("create.branchLoadError")}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.department")}
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET_DEPARTMENT}>{t("create.departmentDefault")}</SelectItem>
              {(departmentsQuery.data ?? []).map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departmentsQuery.isError && (
            <span className="text-xs text-red-600">{t("create.departmentLoadError")}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.role")}
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger>
              <SelectValue placeholder={t("create.selectRole")} />
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
            <span className="text-xs text-red-600">{t("create.roleLoadError")}</span>
          )}
        </label>

        <Button
          type="submit"
          disabled={mutation.isPending || !email || !password || !fullName || !branchId || !roleId}
          className="self-start"
        >
          {mutation.isPending ? t("create.submitting") : t("create.submit")}
        </Button>
      </form>
    </section>
  );
}
