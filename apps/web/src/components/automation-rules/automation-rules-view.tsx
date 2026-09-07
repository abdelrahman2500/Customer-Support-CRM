"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useAutomationRulesQuery,
  useCreateAutomationRuleMutation,
  useUpdateAutomationRuleMutation,
} from "@/hooks/use-automation-rules";
import { useDepartmentsQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { AUTOMATION_ACTION_ASSIGNMENT_MODES } from "@/lib/automation-rules-api";
import type { AutomationActionAssignmentMode, AutomationRuleSummary } from "@/lib/automation-rules-api";
import type { TicketPriority } from "@/lib/tickets-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
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
 *
 * Story 120 — `conditionCategory`/`actionSetCategory` (free-text `Input`s)
 * became `conditionCategoryId`/`actionSetCategoryId` `Select`s sourced
 * from `useTicketCategoriesQuery()`, resolved to a display name the same
 * way `actionSetDepartmentId` already is.
 *
 * RM-24 — `actionAssignmentMode` (`FIXED`/`LEAST_LOADED`) and
 * `eligibleAgentPool` added. `actionAssignToUserId`'s own `Select` stays
 * visible and required for both modes — it's `LEAST_LOADED`'s own
 * fallback assignee when `eligibleAgentPool` is empty, not a field that
 * stops mattering once that mode is chosen. The pool picker is a
 * `Checkbox` list, mirroring `AddApiKeyForm`'s own scopes picker (RM-22):
 * this codebase has no multi-select `Select` variant anywhere.
 *
 * RM-29 — `actionSetPriority` added, a fourth optional action field
 * alongside `actionSetCategory`/`actionSetDepartmentId`, resolved the same
 * "no action" way those two already are (`t("noAction")` placeholder,
 * `UNSET_PRIORITY` sentinel — mirrors `CreateTicketView`'s own
 * `UNSET_PRIORITY` precedent). Raw priority values are shown as-is, never
 * translated — mirrors `CreateTicketView`'s own priority `Select` (this
 * codebase has no localized priority-label convention anywhere).
 */
const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const UNSET_PRIORITY = "__unset__";
export function AutomationRulesView() {
  const t = useTranslations("automationRules");
  const rulesQuery = useAutomationRulesQuery();
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const categoriesQuery = useTicketCategoriesQuery();

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

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoriesQuery.data]);

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
        <p className="rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
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
              <TableHead>{t("columns.setPriority")}</TableHead>
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
                categoryNameById={categoryNameById}
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
  categoryNameById,
}: {
  rule: AutomationRuleSummary;
  userNameById: Map<string, string>;
  departmentNameById: Map<string, string>;
  categoryNameById: Map<string, string>;
}) {
  const t = useTranslations("automationRules");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateAutomationRuleMutation(rule.id);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  function handleToggleActiveClick() {
    if (rule.isActive) {
      setConfirmDeactivateOpen(true);
      return;
    }
    mutation.mutate({ isActive: true });
  }

  function confirmDeactivate() {
    mutation.mutate({ isActive: false }, { onSuccess: () => setConfirmDeactivateOpen(false) });
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-800">{rule.name}</TableCell>
      <TableCell className="text-slate-500">
        {rule.conditionCategoryId
          ? (categoryNameById.get(rule.conditionCategoryId) ?? rule.conditionCategoryId)
          : t("anyCategory")}
      </TableCell>
      <TableCell className="text-slate-500">
        {rule.actionAssignmentMode === "LEAST_LOADED" ? (
          <span>
            {t("leastLoaded")}
            {" — "}
            {t("eligibleAgentCount", { count: rule.eligibleAgentPool.length })}
          </span>
        ) : (
          userNameById.get(rule.actionAssignToUserId) ?? rule.actionAssignToUserId
        )}
      </TableCell>
      <TableCell className="text-slate-500">
        {rule.actionSetCategoryId
          ? (categoryNameById.get(rule.actionSetCategoryId) ?? rule.actionSetCategoryId)
          : t("noAction")}
      </TableCell>
      <TableCell className="text-slate-500">
        {rule.actionSetDepartmentId
          ? (departmentNameById.get(rule.actionSetDepartmentId) ?? rule.actionSetDepartmentId)
          : t("noAction")}
      </TableCell>
      <TableCell className="text-slate-500">{rule.actionSetPriority ?? t("noAction")}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={rule.isActive ? "success" : "secondary"}>
            {rule.isActive ? t("active") : t("inactive")}
          </Badge>
          <Button
            variant={rule.isActive ? "destructive" : "outline"}
            size="sm"
            disabled={mutation.isPending}
            onClick={handleToggleActiveClick}
          >
            {rule.isActive ? t("deactivate") : t("activate")}
          </Button>
          <ConfirmDialog
            open={confirmDeactivateOpen}
            onOpenChange={setConfirmDeactivateOpen}
            title={t("deactivateConfirmTitle")}
            description={t("deactivateConfirmDescription", { name: rule.name })}
            confirmLabel={t("deactivate")}
            onConfirm={confirmDeactivate}
            isPending={mutation.isPending}
          />
        </div>
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {errorMessage(mutation.error, {
              forbidden: t("actionForbidden"),
              generic: t("actionFailed"),
            })}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

/** The smallest UI surface for a create form — an inline form below
 * the table, mirroring `AddDepartmentForm`'s exact submit/error pattern.
 * Story 83 — gains two new optional fields, `actionSetCategory`/
 * `actionSetDepartmentId`, alongside the original three.
 * RM-24 — gains the assignment-mode `Select` and, only when
 * `LEAST_LOADED` is chosen, the eligible-agent-pool `Checkbox` list. */
function AddAutomationRuleForm() {
  const t = useTranslations("automationRules");
  const errorMessage = useErrorMessage();
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const categoriesQuery = useTicketCategoriesQuery();
  const [name, setName] = useState("");
  const [conditionCategoryId, setConditionCategoryId] = useState("");
  const [actionAssignToUserId, setActionAssignToUserId] = useState("");
  const [actionSetCategoryId, setActionSetCategoryId] = useState("");
  const [actionSetDepartmentId, setActionSetDepartmentId] = useState("");
  const [actionSetPriority, setActionSetPriority] = useState(UNSET_PRIORITY);
  const [actionAssignmentMode, setActionAssignmentMode] =
    useState<AutomationActionAssignmentMode>("FIXED");
  const [eligibleAgentPool, setEligibleAgentPool] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateAutomationRuleMutation();

  function toggleEligibleAgent(userId: string, checked: boolean) {
    setEligibleAgentPool((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        actionAssignToUserId,
        actionAssignmentMode,
        ...(conditionCategoryId ? { conditionCategoryId } : {}),
        ...(actionSetCategoryId ? { actionSetCategoryId } : {}),
        ...(actionSetDepartmentId ? { actionSetDepartmentId } : {}),
        ...(actionSetPriority !== UNSET_PRIORITY
          ? { actionSetPriority: actionSetPriority as TicketPriority }
          : {}),
        ...(actionAssignmentMode === "LEAST_LOADED" ? { eligibleAgentPool } : {}),
      });
      setName("");
      setConditionCategoryId("");
      setActionAssignToUserId("");
      setActionSetCategoryId("");
      setActionSetDepartmentId("");
      setActionSetPriority(UNSET_PRIORITY);
      setActionAssignmentMode("FIXED");
      setEligibleAgentPool([]);
    } catch (submitError) {
      setError(
        errorMessage(submitError, { forbidden: t("actionForbidden"), generic: t("createFailed") }),
      );
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("createHeading")}</h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-end gap-2">
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
            <Select value={conditionCategoryId} onValueChange={setConditionCategoryId}>
              <SelectTrigger className="w-40" aria-label={t("conditionCategoryLabel")}>
                <SelectValue placeholder={t("anyCategory")} />
              </SelectTrigger>
              <SelectContent>
                {(categoriesQuery.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {t("assignmentModeLabel")}
            <Select
              value={actionAssignmentMode}
              onValueChange={(value) => setActionAssignmentMode(value as AutomationActionAssignmentMode)}
            >
              <SelectTrigger className="w-40" aria-label={t("assignmentModeLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_ACTION_ASSIGNMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode === "LEAST_LOADED" ? t("leastLoaded") : t("fixed")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {actionAssignmentMode === "LEAST_LOADED" ? t("fallbackAssignToLabel") : t("actionAssignToLabel")}
            <Select value={actionAssignToUserId} onValueChange={setActionAssignToUserId}>
              <SelectTrigger
                className="w-56"
                aria-label={
                  actionAssignmentMode === "LEAST_LOADED"
                    ? t("fallbackAssignToLabel")
                    : t("actionAssignToLabel")
                }
              >
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
            <Select value={actionSetCategoryId} onValueChange={setActionSetCategoryId}>
              <SelectTrigger className="w-40" aria-label={t("actionSetCategoryLabel")}>
                <SelectValue placeholder={t("noAction")} />
              </SelectTrigger>
              <SelectContent>
                {(categoriesQuery.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {t("actionSetDepartmentLabel")}
            <Select value={actionSetDepartmentId} onValueChange={setActionSetDepartmentId}>
              <SelectTrigger className="w-56" aria-label={t("actionSetDepartmentLabel")}>
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
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {t("actionSetPriorityLabel")}
            <Select value={actionSetPriority} onValueChange={setActionSetPriority}>
              <SelectTrigger className="w-40" aria-label={t("actionSetPriorityLabel")}>
                <SelectValue placeholder={t("noAction")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET_PRIORITY}>{t("noAction")}</SelectItem>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
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
        </div>

        {actionAssignmentMode === "LEAST_LOADED" && (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-600">{t("eligibleAgentPoolLabel")}</legend>
            <div className="flex flex-wrap gap-3">
              {(usersQuery.data ?? []).map((user) => (
                <div key={user.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`eligible-agent-${user.id}`}
                    checked={eligibleAgentPool.includes(user.id)}
                    onCheckedChange={(checked) => toggleEligibleAgent(user.id, checked === true)}
                  />
                  <Label htmlFor={`eligible-agent-${user.id}`} className="text-xs font-normal">
                    {user.fullName}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <Alert variant="destructive" className="w-full">
            {error}
          </Alert>
        )}
      </form>
    </div>
  );
}
