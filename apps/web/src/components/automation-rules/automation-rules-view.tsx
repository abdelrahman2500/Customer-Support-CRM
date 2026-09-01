"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useAutomationRulesQuery,
  useCreateAutomationRuleMutation,
  useUpdateAutomationRuleMutation,
} from "@/hooks/use-automation-rules";
import { useDepartmentsQuery, useUsersQuery } from "@/hooks/use-tickets";
import type { AutomationRuleSummary } from "@/lib/automation-rules-api";
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

/**
 * Story 57 — Automation Rules, over the already-existing
 * `GET/POST/PATCH /automation-rules`. Mirrors `BranchDepartmentsView`'s
 * "table + inline add-form below it, no separate route" single-page shape
 * exactly — a rule has only three fields, the same "smallest UI surface"
 * reasoning `AddDepartmentForm` already established.
 *
 * The action column resolves `actionAssignToUserId` through the
 * already-fetched, already-shared `useUsersQuery()` cache, mirroring
 * `TicketListView`'s/`AuditLogView`'s own name-resolution convention.
 *
 * Story 83 — `actionSetCategory`/`actionSetDepartmentId` added as two new
 * optional action fields, resolving `actionSetDepartmentId` through
 * `useDepartmentsQuery()` the same way `actionAssignToUserId` resolves
 * through `useUsersQuery()`.
 */
export function AutomationRulesView() {
  const t = useTranslations("automationRules");
  const rulesQuery = useAutomationRulesQuery();
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of departmentsQuery.data ?? []) {
      map.set(department.id, department.name);
    }
    return map;
  }, [departmentsQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      {rulesQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {rulesQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => rulesQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {rulesQuery.isSuccess && rulesQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("empty")}
        </p>
      )}

      {rulesQuery.isSuccess && rulesQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.condition")}</TableHead>
              <TableHead>{t("columns.assignTo")}</TableHead>
              <TableHead>{t("columns.setCategory")}</TableHead>
              <TableHead>{t("columns.setDepartment")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rulesQuery.data.map((rule) => (
              <AutomationRuleRow
                key={rule.id}
                rule={rule}
                userNameById={userNameById}
                departmentNameById={departmentNameById}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <AddAutomationRuleForm />
    </section>
  );
}

/** One existing rule's row — a dedicated component so
 * `useUpdateAutomationRuleMutation` is called once per row, mirroring
 * `SlaPolicyRow`/`DepartmentRow`'s Rules-of-Hooks convention. */
function AutomationRuleRow({
  rule,
  userNameById,
  departmentNameById,
}: {
  rule: AutomationRuleSummary;
  userNameById: Map<string, string>;
  departmentNameById: Map<string, string>;
}) {
  const t = useTranslations("automationRules");
  const mutation = useUpdateAutomationRuleMutation(rule.id);

  function toggleActive() {
    mutation.mutate({ isActive: !rule.isActive });
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-800">{rule.name}</TableCell>
      <TableCell className="text-slate-500">
        {rule.conditionCategory ?? t("anyCategory")}
      </TableCell>
      <TableCell className="text-slate-500">
        {userNameById.get(rule.actionAssignToUserId) ?? rule.actionAssignToUserId}
      </TableCell>
      <TableCell className="text-slate-500">{rule.actionSetCategory ?? t("noAction")}</TableCell>
      <TableCell className="text-slate-500">
        {rule.actionSetDepartmentId
          ? (departmentNameById.get(rule.actionSetDepartmentId) ?? rule.actionSetDepartmentId)
          : t("noAction")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={rule.isActive ? "success" : "secondary"}>
            {rule.isActive ? t("active") : t("inactive")}
          </Badge>
          <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={toggleActive}>
            {rule.isActive ? t("deactivate") : t("activate")}
          </Button>
        </div>
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {mutation.error instanceof ApiError && mutation.error.status === 403
              ? t("actionForbidden")
              : t("actionFailed")}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

/** The smallest UI surface for a create form — an inline form below
 * the table, mirroring `AddDepartmentForm`'s exact submit/error pattern.
 * Story 83 — gains two new optional fields, `actionSetCategory`/
 * `actionSetDepartmentId`, alongside the original three. */
function AddAutomationRuleForm() {
  const t = useTranslations("automationRules");
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const [name, setName] = useState("");
  const [conditionCategory, setConditionCategory] = useState("");
  const [actionAssignToUserId, setActionAssignToUserId] = useState("");
  const [actionSetCategory, setActionSetCategory] = useState("");
  const [actionSetDepartmentId, setActionSetDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateAutomationRuleMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        actionAssignToUserId,
        ...(conditionCategory.trim() ? { conditionCategory: conditionCategory.trim() } : {}),
        ...(actionSetCategory.trim() ? { actionSetCategory: actionSetCategory.trim() } : {}),
        ...(actionSetDepartmentId ? { actionSetDepartmentId } : {}),
      });
      setName("");
      setConditionCategory("");
      setActionAssignToUserId("");
      setActionSetCategory("");
      setActionSetDepartmentId("");
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("createFailed"));
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("createHeading")}</h2>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("nameLabel")}
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={1}
            className="w-56"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("conditionCategoryLabel")}
          <Input
            value={conditionCategory}
            placeholder={t("anyCategory")}
            onChange={(event) => setConditionCategory(event.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("actionAssignToLabel")}
          <Select value={actionAssignToUserId} onValueChange={setActionAssignToUserId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("actionAssignToPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {(usersQuery.data ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("actionSetCategoryLabel")}
          <Input
            value={actionSetCategory}
            placeholder={t("noAction")}
            onChange={(event) => setActionSetCategory(event.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("actionSetDepartmentLabel")}
          <Select value={actionSetDepartmentId} onValueChange={setActionSetDepartmentId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("noAction")} />
            </SelectTrigger>
            <SelectContent>
              {(departmentsQuery.data ?? []).map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || !name.trim() || !actionAssignToUserId}
        >
          {mutation.isPending ? t("createSubmitting") : t("createSubmit")}
        </Button>
        {error && (
          <Alert variant="destructive" className="w-full">
            {error}
          </Alert>
        )}
      </form>
    </div>
  );
}
