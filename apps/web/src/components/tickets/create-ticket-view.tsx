"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateTicketMutation, useCustomersQuery } from "@/hooks/use-tickets";
import type { TicketPriority } from "@/lib/tickets-api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const UNSET_PRIORITY = "__unset__";

/**
 * Story 25 — Create Ticket (plan Task 4). Submits only `{ customerId,
 * subject, category?, priority? }` through the existing `POST /tickets` —
 * `contactId`/`departmentId`/`assignedToUserId` are never sent (plan Design
 * item 3). The customer picker reuses the same `useCustomersQuery()` cache
 * every other workspace screen already uses (Design item 1) — no new
 * backend search/autocomplete. Never optimistic: on success, navigates to
 * the real new ticket's detail page, which fetches its own real state.
 */
export function CreateTicketView() {
  const t = useTranslations("tickets");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<string>(UNSET_PRIORITY);
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useCustomersQuery();
  const mutation = useCreateTicketMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      const ticket = await mutation.mutateAsync({
        customerId,
        subject,
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(priority !== UNSET_PRIORITY ? { priority: priority as TicketPriority } : {}),
      });
      router.push(`/${locale}/tickets/${ticket.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError ? submitError.message : t("create.createFailed"),
      );
    }
  }

  return (
    <section className="flex max-w-md flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("create.title")}</h1>

      {error && <Alert variant="destructive">{error}</Alert>}

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.customer")}
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder={t("create.selectCustomer")} />
            </SelectTrigger>
            <SelectContent>
              {(customersQuery.data ?? []).map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a className="text-xs text-slate-500 underline" href={`/${locale}/customers/new`}>
            {t("create.createCustomerLink")}
          </a>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.subject")}
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            minLength={1}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.category")}
          <Input value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.priority")}
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
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
        </label>

        <Button
          type="submit"
          disabled={mutation.isPending || !customerId}
          className="self-start"
        >
          {mutation.isPending ? t("create.submitting") : t("create.submit")}
        </Button>
      </form>
    </section>
  );
}
