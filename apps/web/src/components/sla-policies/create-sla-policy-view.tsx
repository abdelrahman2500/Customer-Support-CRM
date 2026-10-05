"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useCreateSlaPolicyMutation } from "@/hooks/use-sla-policies";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import type { SlaPolicyPriority } from "@/lib/sla-policies-api";
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

const PRIORITY_OPTIONS: SlaPolicyPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const UNSET_PRIORITY = "__unset__";
const UNSET_CATEGORY = "__unset__";

/**
 * Story 31 — Create SLA Policy (plan Task 4), mirroring `CreateTicketView`'s
 * plain `useState` shape exactly: no form/validation library. Submits only
 * the existing `CreateSlaPolicyDto` shape through the real `POST
 * /sla-policies` — `departmentId`/`category`/`priority` are optional scoping,
 * both target minutes are required. `departmentId` is a plain text field (no
 * department picker exists anywhere in this codebase yet to reuse).
 *
 * Never optimistic: on success, navigates to the real list, which re-fetches
 * the real, authoritative state — no optimistic row is ever inserted. On a
 * rejected submission every entered value is preserved (state is never
 * cleared on error) so the agent can retry without re-typing.
 */
export function CreateSlaPolicyView() {
  const t = useTranslations("slaPolicies");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState<string>(UNSET_CATEGORY);
  const [priority, setPriority] = useState<string>(UNSET_PRIORITY);
  const [responseTargetMinutes, setResponseTargetMinutes] = useState("");
  const [resolutionTargetMinutes, setResolutionTargetMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateSlaPolicyMutation();
  const categoriesQuery = useTicketCategoriesQuery();

  const parsedResponse = Number(responseTargetMinutes);
  const parsedResolution = Number(resolutionTargetMinutes);
  const responseValid = Number.isInteger(parsedResponse) && parsedResponse >= 1;
  const resolutionValid = Number.isInteger(parsedResolution) && parsedResolution >= 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!responseValid || !resolutionValid) {
      setError(t("create.invalidTargets"));
      return;
    }

    try {
      await mutation.mutateAsync({
        ...(departmentId.trim() ? { departmentId: departmentId.trim() } : {}),
        ...(categoryId !== UNSET_CATEGORY ? { categoryId } : {}),
        ...(priority !== UNSET_PRIORITY ? { priority: priority as SlaPolicyPriority } : {}),
        responseTargetMinutes: parsedResponse,
        resolutionTargetMinutes: parsedResolution,
      });
      showSuccessToast(t("create.createSuccess"));
      router.push(`/${locale}/sla-policies`);
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
    ...(responseTargetMinutes ? [] : [t("create.responseTarget")]),
    ...(resolutionTargetMinutes ? [] : [t("create.resolutionTarget")]),
  ];

  return (
    <section className="flex max-w-3xl flex-col gap-section">
      <PageHeader title={t("create.title")} description={tCommon("form.requiredHint")} />

      <form onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-section p-surface">
          <FormSection
            title={t("create.sectionScope")}
            description={t("create.sectionScopeHint")}
            columns={2}
          >
            <FormField label={t("create.department")} density="comfortable">
              <Input
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                placeholder={t("create.departmentPlaceholder")}
              />
            </FormField>
            <FormField label={t("create.category")} density="comfortable">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger aria-label={t("create.category")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_CATEGORY}>{t("create.categoryDefault")}</SelectItem>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("create.priority")} density="comfortable">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger aria-label={t("create.priority")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_PRIORITY}>{t("create.priorityDefault")}</SelectItem>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormSection>

          <FormSection title={t("create.sectionTargets")} columns={2}>
            <FormField label={t("create.responseTarget")} required density="comfortable">
              <Input
                type="number"
                inputMode="numeric"
                value={responseTargetMinutes}
                onChange={(event) => setResponseTargetMinutes(event.target.value)}
                required
              />
            </FormField>
            <FormField label={t("create.resolutionTarget")} required density="comfortable">
              <Input
                type="number"
                inputMode="numeric"
                value={resolutionTargetMinutes}
                onChange={(event) => setResolutionTargetMinutes(event.target.value)}
                required
              />
            </FormField>
          </FormSection>

          <FormActions
            error={error}
            reason={missing.length > 0 ? missingReason(tCommon, locale, missing) : undefined}
            reasonId={reasonId}
          >
            <Button
              type="submit"
              disabled={mutation.isPending || !responseTargetMinutes || !resolutionTargetMinutes}
              aria-describedby={missing.length > 0 ? reasonId : undefined}
            >
              {mutation.isPending ? t("create.submitting") : t("create.submit")}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href={`/${locale}/sla-policies`}>{tCommon("form.cancel")}</Link>
            </Button>
          </FormActions>
        </Card>
      </form>
    </section>
  );
}
