"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useBranchesQuery, useCreateUserMutation, useDepartmentsQuery } from "@/hooks/use-tickets";
import { useRolesQuery } from "@/hooks/use-roles";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Button,
  Card,
  FormActions,
  FormField,
  FormSection,
  Input,
  PageHeader,
  showSuccessToast,
} from "@crm/ui";
import { missingReason } from "@/lib/form-reason";
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
  const tCommon = useTranslations("common");
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

  // Story 225 (PR-4.4) — what still blocks the submit, said beside it.
  const reasonId = useId();
  const missing = [
    ...(email ? [] : [t("create.email")]),
    ...(password ? [] : [t("create.password")]),
    ...(fullName ? [] : [t("create.fullName")]),
    ...(branchId ? [] : [t("create.branch")]),
    ...(roleId ? [] : [t("create.role")]),
  ];

  return (
    <section className="flex max-w-3xl flex-col gap-section">
      <PageHeader title={t("create.title")} description={tCommon("form.requiredHint")} />

      <form onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-section p-surface">
          <FormSection title={t("create.sectionPerson")} columns={2}>
            <FormField label={t("create.fullName")} required density="comfortable">
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                minLength={1}
              />
            </FormField>
            <FormField label={t("create.email")} required density="comfortable">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </FormField>
            <FormField
              label={t("create.password")}
              required
              density="comfortable"
              hint={t("create.passwordHint")}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </FormField>
          </FormSection>

          <FormSection title={t("create.sectionAccess")} columns={2}>
            <FormField
              label={t("create.branch")}
              required
              density="comfortable"
              error={branchesQuery.isError ? t("create.branchLoadError") : undefined}
            >
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger aria-label={t("create.branch")}>
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
            </FormField>
            <FormField
              label={t("create.department")}
              density="comfortable"
              error={departmentsQuery.isError ? t("create.departmentLoadError") : undefined}
            >
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger aria-label={t("create.department")}>
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
            </FormField>
            <FormField
              label={t("create.role")}
              required
              density="comfortable"
              error={rolesQuery.isError ? t("create.roleLoadError") : undefined}
            >
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger aria-label={t("create.role")}>
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
            </FormField>
          </FormSection>

          <FormActions
            error={error}
            reason={missing.length > 0 ? missingReason(tCommon, locale, missing) : undefined}
            reasonId={reasonId}
          >
            <Button
              type="submit"
              disabled={mutation.isPending || missing.length > 0}
              aria-describedby={missing.length > 0 ? reasonId : undefined}
            >
              {mutation.isPending ? t("create.submitting") : t("create.submit")}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href={`/${locale}/users`}>{tCommon("form.cancel")}</Link>
            </Button>
          </FormActions>
        </Card>
      </form>
    </section>
  );
}
