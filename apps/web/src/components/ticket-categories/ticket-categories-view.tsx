"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateTicketCategoryMutation,
  useManagedTicketCategoriesQuery,
  useUpdateTicketCategoryMutation,
} from "@/hooks/use-ticket-categories";
import type { TicketCategory } from "@/lib/ticket-categories-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Input,
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

/**
 * Story 120 — Ticketing: Managed Category Taxonomy. Mirrors
 * `BranchDepartmentsView`'s `DepartmentsSection`/`DepartmentRow`/
 * `AddDepartmentForm` verbatim — list + inline rename + activate/
 * deactivate + inline "add" form, no delete route (see
 * `TicketCategoriesService`'s own doc comment for why).
 */
export function TicketCategoriesView() {
  const t = useTranslations("ticketCategories");
  const categoriesQuery = useManagedTicketCategoriesQuery();

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">{t("heading")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("description")}</p>

        {categoriesQuery.isLoading && (
          <div className="mt-4 flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        )}

        {categoriesQuery.isError && (
          <Alert variant="destructive" className="mt-4 flex items-center justify-between">
            <span>{t("error")}</span>
            <Button variant="outline" size="sm" onClick={() => categoriesQuery.refetch()}>
              {t("retry")}
            </Button>
          </Alert>
        )}

        {categoriesQuery.isSuccess && categoriesQuery.data.length === 0 && (
          <p className="mt-4 rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
            {t("empty")}
          </p>
        )}

        {categoriesQuery.isSuccess && categoriesQuery.data.length > 0 && (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriesQuery.data.map((category) => (
                <TicketCategoryRow key={category.id} category={category} />
              ))}
            </TableBody>
          </Table>
        )}

        <AddTicketCategoryForm />
      </div>
    </section>
  );
}

/**
 * One existing category's row — a dedicated component (not inline in a
 * `.map()`) because `useUpdateTicketCategoryMutation` is a hook and must be
 * called once per component instance (React's rules of hooks), mirroring
 * `DepartmentRow`'s exact shape.
 */
function TicketCategoryRow({ category }: { category: TicketCategory }) {
  const t = useTranslations("ticketCategories");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateTicketCategoryMutation(category.id);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === category.name) {
      setNameDraft(category.name);
      return;
    }
    mutation.mutate({ name: trimmed }, { onError: () => setNameDraft(category.name) });
  }

  function handleToggleActiveClick() {
    if (category.isActive) {
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
      <TableCell>
        <Input
          className="min-w-[10rem]"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
        />
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {errorMessage(mutation.error, {
              forbidden: t("actionForbidden"),
              generic: t("actionFailed"),
            })}
          </p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={category.isActive ? "success" : "secondary"}>
            {category.isActive ? t("active") : t("inactive")}
          </Badge>
          <Button
            variant={category.isActive ? "destructive" : "outline"}
            size="sm"
            disabled={mutation.isPending}
            onClick={handleToggleActiveClick}
          >
            {category.isActive ? t("deactivate") : t("activate")}
          </Button>
          <ConfirmDialog
            open={confirmDeactivateOpen}
            onOpenChange={setConfirmDeactivateOpen}
            title={t("deactivateConfirmTitle")}
            description={t("deactivateConfirmDescription", { name: category.name })}
            confirmLabel={t("deactivate")}
            onConfirm={confirmDeactivate}
            isPending={mutation.isPending}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * The smallest UI surface for a one-field create — an inline form below the
 * table, mirroring `AddDepartmentForm`'s exact submit/error-handling
 * pattern.
 */
function AddTicketCategoryForm() {
  const t = useTranslations("ticketCategories");
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateTicketCategoryMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ name: name.trim() });
      setName("");
      showSuccessToast(t("createSuccess", { name: name.trim() }));
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("actionForbidden"),
          generic: t("createFailed"),
        }),
      );
    }
  }

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("nameLabel")}
        <Input
          value={name}
          placeholder={t("createPlaceholder")}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={1}
          className="w-56"
        />
      </label>
      <Button type="submit" size="sm" disabled={mutation.isPending || !name.trim()}>
        {mutation.isPending ? t("createSubmitting") : t("createSubmit")}
      </Button>
      {error && (
        <Alert variant="destructive" className="w-full">
          {error}
        </Alert>
      )}
    </form>
  );
}
