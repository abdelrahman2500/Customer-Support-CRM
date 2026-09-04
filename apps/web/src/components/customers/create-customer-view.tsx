"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateCustomerMutation } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import { Alert, Button, Input } from "@crm/ui";

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
      setError(submitError instanceof ApiError ? submitError.message : t("createFailed"));
    }
  }

  return (
    <section className="flex max-w-md flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("create.title")}</h1>

      {created && (
        <Alert variant="success">
          {t("create.success", { name: created.displayName })}{" "}
          <a className="underline" href={`/${locale}/tickets/new`}>
            {t("create.createTicketLink")}
          </a>
        </Alert>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.displayName")}
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            minLength={1}
          />
        </label>
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {mutation.isPending ? t("create.submitting") : t("create.submit")}
        </Button>
      </form>
    </section>
  );
}
