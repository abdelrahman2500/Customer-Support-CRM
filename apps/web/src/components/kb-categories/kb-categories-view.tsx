"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateKbCategoryMutation,
  useManagedKbCategoriesQuery,
  useUpdateKbCategoryMutation,
} from "@/hooks/use-kb-categories";
import type { KbCategory } from "@/lib/kb-categories-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  QueryStateCard,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  showSuccessToast,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * RM-27 — Knowledge Base Category Taxonomy. Mirrors `TicketCategoriesView`'s
 * `TicketCategoryRow`/`AddTicketCategoryForm` verbatim — list + inline
 * rename + activate/deactivate + inline "add" form, no delete route (see
 * `KbCategoriesService`'s own doc comment for why).
 */
export function KbCategoriesView() {
  const t = useTranslations("kbCategories");
  const tCommon = useTranslations("common");
  const categoriesQuery = useManagedKbCategoriesQuery();

  return (
    <section className="flex flex-col gap-6">
      <Card className="p-surface">
        <PageHeader title={t("heading")} />
        <p className="mt-1 text-sm text-ink-subtle">{t("description")}</p>

        {/* Story 155 — the hand-rolled four-branch ladder, replaced by the
            shared primitive. Same skeleton, same retry, same empty copy.
            `isError` now also requires `data === undefined`, so a failed
            background refetch keeps the rows on screen instead of throwing
            away readable content (Story S-7's reasoning). */}
        <QueryStateCard
          className="mt-4"
          isLoading={categoriesQuery.isLoading}
          isError={categoriesQuery.isError && categoriesQuery.data === undefined}
          isEmpty={categoriesQuery.isSuccess && categoriesQuery.data.length === 0}
          loadingLabel={tCommon("loading")}
          loadingPlaceholder={
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          }
          error={{
            title: t("error"),
            retryLabel: t("retry"),
            onRetry: () => void categoriesQuery.refetch(),
          }}
          backgroundError={
            categoriesQuery.isError && categoriesQuery.data !== undefined
              ? {
                  title: t("error"),
                  retryLabel: t("retry"),
                  onRetry: () => void categoriesQuery.refetch(),
                }
              : undefined
          }
          empty={{ title: t("empty") }}
        >
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categoriesQuery.data ?? []).map((category) => (
                <KbCategoryRow key={category.id} category={category} />
              ))}
            </TableBody>
          </Table>
        </QueryStateCard>

        <AddKbCategoryForm />
      </Card>
    </section>
  );
}

/**
 * One existing category's row — a dedicated component (not inline in a
 * `.map()`) because `useUpdateKbCategoryMutation` is a hook and must be
 * called once per component instance (React's rules of hooks), mirroring
 * `TicketCategoryRow`'s exact shape.
 */
function KbCategoryRow({ category }: { category: KbCategory }) {
  const t = useTranslations("kbCategories");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateKbCategoryMutation(category.id);
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
      {/* Story 150 — labels reuse each column's own header key. */}
      <TableCell label={t("columns.name")}>
        <Input
          className="min-w-[10rem]"
          aria-label={t("columns.name")}
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
        />
        {mutation.isError && (
          <p className="mt-1 text-xs text-danger-foreground">
            {errorMessage(mutation.error, {
              forbidden: t("actionForbidden"),
              generic: t("actionFailed"),
            })}
          </p>
        )}
      </TableCell>
      <TableCell label={t("columns.status")}>
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
 * table, mirroring `AddTicketCategoryForm`'s exact submit/error-handling
 * pattern.
 */
function AddKbCategoryForm() {
  const t = useTranslations("kbCategories");
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateKbCategoryMutation();

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
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
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
