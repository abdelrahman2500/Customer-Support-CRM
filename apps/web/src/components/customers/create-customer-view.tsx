"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateCustomerMutation } from "@/hooks/use-tickets";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Button,
  Card,
  FormActions,
  FormField,
  FormSection,
  Input,
  PageHeader,
} from "@crm/ui";
import { missingReason } from "@/lib/form-reason";

/**
 * Story 25 — Create Customer (plan Task 3). Submits only `{ displayName }`
 * through the existing `POST /customers` (Design item 5: no form/validation
 * library — plain state, matching the login page's own shape, the only
 * other form in this codebase). Never optimistic (Design item 6): the
 * `customers` list query is only invalidated after a real success response.
 * No customer-detail page exists to navigate to (none was ever built by
 * Story 23) — on success this shows a confirmation and a link onward to
 * ticket creation, per the plan's own explicit, non-inventing scope.
 */
export function CreateCustomerView() {
  const t = useTranslations("customers");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { locale } = useParams<{ locale: string }>();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ displayName: string } | null>(null);
  const mutation = useCreateCustomerMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setCreated(null);

    try {
      const customer = await mutation.mutateAsync({ displayName });
      setCreated(customer);
      setDisplayName("");
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("create.createForbidden"),
          generic: t("create.createFailed"),
        }),
      );
    }
  }

  // Story 225 (PR-4.4) — what still blocks the submit, said beside it.
  const reasonId = useId();
  const missing = displayName.trim() ? [] : [t("create.displayName")];

  return (
    <section className="flex max-w-2xl flex-col gap-section">
      <PageHeader title={t("create.title")} description={tCommon("form.requiredHint")} />

      {created && (
        <Alert variant="success">
          {t("create.success", { name: created.displayName })}{" "}
          <Link className="underline" href={`/${locale}/tickets/new`}>
            {t("create.createTicketLink")}
          </Link>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-section p-surface">
          <FormSection title={t("create.sectionDetails")}>
            <FormField label={t("create.displayName")} required density="comfortable">
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                minLength={1}
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
              disabled={mutation.isPending}
              aria-describedby={missing.length > 0 ? reasonId : undefined}
            >
              {mutation.isPending ? t("create.submitting") : t("create.submit")}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href={`/${locale}/customers`}>{tCommon("form.cancel")}</Link>
            </Button>
          </FormActions>
        </Card>
      </form>
    </section>
  );
}
