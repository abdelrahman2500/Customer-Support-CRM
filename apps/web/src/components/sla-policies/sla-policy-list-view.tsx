"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSlaPoliciesQuery, useUpdateSlaPolicyMutation } from "@/hooks/use-sla-policies";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import type { SlaPolicySummary } from "@/lib/sla-policies-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Story 31 — SLA Policy list, over the already-existing `GET /sla-policies`
 * (Story 10, never before consumed by any frontend). Mirrors
 * `TicketListView`'s loading/error/empty conventions and `UserListView`'s
 * inline blur-commit-with-revert-on-error field pattern (plan Design item 2).
 *
 * Scoping (department/category/priority) is read-only — only
 * `responseTargetMinutes`/`resolutionTargetMinutes`/`isActive` are editable,
 * since changing scoping fields would change which tickets a policy applies
 * to (a bigger behavior change than this story's "let people see and tune
 * targets" goal).
 */
export function SlaPolicyListView() {
  const t = useTranslations("slaPolicies");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const policiesQuery = useSlaPoliciesQuery();
  const categoriesQuery = useTicketCategoriesQuery();

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoriesQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
        <Button size="sm" onClick={() => router.push(`/${locale}/sla-policies/new`)}>
          {t("list.createButton")}
        </Button>
      </div>

      {policiesQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {policiesQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("list.error")}</span>
          <Button variant="outline" size="sm" onClick={() => policiesQuery.refetch()}>
            {t("list.retry")}
          </Button>
        </Alert>
      )}

      {policiesQuery.isSuccess && policiesQuery.data.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">{t("list.empty")}</p>
          <Button size="sm" className="mt-3" onClick={() => router.push(`/${locale}/sla-policies/new`)}>
            {t("list.createButton")}
          </Button>
        </div>
      )}

      {policiesQuery.isSuccess && policiesQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.columns.department")}</TableHead>
              <TableHead>{t("list.columns.category")}</TableHead>
              <TableHead>{t("list.columns.priority")}</TableHead>
              <TableHead>{t("list.columns.responseTarget")}</TableHead>
              <TableHead>{t("list.columns.resolutionTarget")}</TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policiesQuery.data.map((policy) => (
              <SlaPolicyRow key={policy.id} policy={policy} categoryNameById={categoryNameById} />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

/**
 * One existing policy's row — a dedicated component (not inline in a
 * `.map()`) because `useUpdateSlaPolicyMutation` is a hook and must be
 * called once per component instance, not once per loop iteration (React's
 * rules of hooks — the same constraint `ContactRow`/`UnclaimedTicketRow`
 * already established elsewhere in this codebase).
 */
function SlaPolicyRow({
  policy,
  categoryNameById,
}: {
  policy: SlaPolicySummary;
  categoryNameById: Map<string, string>;
}) {
  const t = useTranslations("slaPolicies");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateSlaPolicyMutation(policy.id);

  const [responseDraft, setResponseDraft] = useState(String(policy.responseTargetMinutes));
  const [resolutionDraft, setResolutionDraft] = useState(String(policy.resolutionTargetMinutes));
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  function commitResponseTarget() {
    const parsed = Number(responseDraft);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setResponseDraft(String(policy.responseTargetMinutes));
      return;
    }
    if (parsed === policy.responseTargetMinutes) {
      return;
    }
    mutation.mutate(
      { responseTargetMinutes: parsed },
      { onError: () => setResponseDraft(String(policy.responseTargetMinutes)) },
    );
  }

  function commitResolutionTarget() {
    const parsed = Number(resolutionDraft);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setResolutionDraft(String(policy.resolutionTargetMinutes));
      return;
    }
    if (parsed === policy.resolutionTargetMinutes) {
      return;
    }
    mutation.mutate(
      { resolutionTargetMinutes: parsed },
      { onError: () => setResolutionDraft(String(policy.resolutionTargetMinutes)) },
    );
  }

  function handleToggleActiveClick() {
    if (policy.isActive) {
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
      <TableCell className="text-slate-500">{policy.departmentId ?? t("list.noDepartment")}</TableCell>
      <TableCell className="text-slate-500">
        {policy.categoryId ? (categoryNameById.get(policy.categoryId) ?? policy.categoryId) : t("list.noCategory")}
      </TableCell>
      <TableCell>
        {policy.priority ? (
          <Badge variant="outline">{policy.priority}</Badge>
        ) : (
          <span className="text-slate-400">{t("list.noPriority")}</span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          className="w-24"
          value={responseDraft}
          aria-label={t("list.columns.responseTarget")}
          onChange={(event) => setResponseDraft(event.target.value)}
          onBlur={commitResponseTarget}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          className="w-24"
          value={resolutionDraft}
          aria-label={t("list.columns.resolutionTarget")}
          onChange={(event) => setResolutionDraft(event.target.value)}
          onBlur={commitResolutionTarget}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={policy.isActive ? "success" : "secondary"}>
            {policy.isActive ? t("list.active") : t("list.inactive")}
          </Badge>
          <Button
            variant={policy.isActive ? "destructive" : "outline"}
            size="sm"
            disabled={mutation.isPending}
            onClick={handleToggleActiveClick}
          >
            {policy.isActive ? t("list.deactivate") : t("list.activate")}
          </Button>
          <ConfirmDialog
            open={confirmDeactivateOpen}
            onOpenChange={setConfirmDeactivateOpen}
            title={t("list.deactivateConfirmTitle")}
            description={t("list.deactivateConfirmDescription")}
            confirmLabel={t("list.deactivate")}
            onConfirm={confirmDeactivate}
            isPending={mutation.isPending}
          />
        </div>
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {errorMessage(mutation.error, {
              forbidden: t("list.actionForbidden"),
              generic: t("list.actionFailed"),
            })}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
