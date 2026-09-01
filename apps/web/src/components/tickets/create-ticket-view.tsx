"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCreateTicketMutation,
  useCustomerQuery,
  useCustomersQuery,
  useDepartmentsQuery,
  useUsersQuery,
} from "@/hooks/use-tickets";
import type { TicketPriority } from "@/lib/tickets-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { showSuccessToast } from "@/lib/toast-store";
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
const UNSET_CONTACT = "__unset__";
const UNSET_DEPARTMENT = "__unset__";
const UNSET_ASSIGNEE = "__unset__";

/**
 * Story 25 — Create Ticket (plan Task 4). Submits `{ customerId, subject,
 * category?, priority? }` through the existing `POST /tickets` — the
 * customer picker reuses the same `useCustomersQuery()` cache every other
 * workspace screen already uses (Design item 1) — no new backend search/
 * autocomplete. Never optimistic: on success, navigates to the real new
 * ticket's detail page, which fetches its own real state.
 *
 * Story 27 — reads an optional `customerId` query parameter (plan Design
 * item 3) and, once it matches a customer in the already-fetched customer
 * list, seeds the existing `customerId` state with it. This only seeds the
 * initial selection — `handleCustomerChange` below is still the only place
 * `customerId` changes after that, so the agent can still pick a different
 * customer afterward. Absent, unknown, or not-yet-loaded, the state simply
 * stays `""`, matching this screen's existing default behavior exactly.
 *
 * Story 43 — adds optional contact/department/assignee pickers, closing the
 * remaining `CreateTicketDto` fields. Contact options come from the
 * selected customer's own already-embedded `contacts` (`useCustomerQuery`,
 * Story 26) — no new endpoint; switching customers resets any chosen
 * contact (`handleCustomerChange`) so a contact never survives a customer
 * switch. Department/assignee reuse `useDepartmentsQuery`/`useUsersQuery`
 * exactly as `CreateUserView`/`TicketDetailView` already do. All three are
 * optional and, left untouched, produce the exact same payload this screen
 * has always sent.
 */
export function CreateTicketView() {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const prefilledCustomerId = searchParams.get("customerId");

  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<string>(UNSET_PRIORITY);
  const [contactId, setContactId] = useState<string>(UNSET_CONTACT);
  const [departmentId, setDepartmentId] = useState<string>(UNSET_DEPARTMENT);
  const [assignedToUserId, setAssignedToUserId] = useState<string>(UNSET_ASSIGNEE);
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useCustomersQuery();
  const customerDetailQuery = useCustomerQuery(customerId);
  const departmentsQuery = useDepartmentsQuery();
  const usersQuery = useUsersQuery();
  const mutation = useCreateTicketMutation();

  function handleCustomerChange(value: string) {
    setCustomerId(value);
    setContactId(UNSET_CONTACT);
  }

  useEffect(() => {
    if (
      prefilledCustomerId &&
      (customersQuery.data ?? []).some((customer) => customer.id === prefilledCustomerId)
    ) {
      setCustomerId(prefilledCustomerId);
    }
  }, [prefilledCustomerId, customersQuery.data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      const ticket = await mutation.mutateAsync({
        customerId,
        subject,
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(priority !== UNSET_PRIORITY ? { priority: priority as TicketPriority } : {}),
        ...(contactId !== UNSET_CONTACT ? { contactId } : {}),
        ...(departmentId !== UNSET_DEPARTMENT ? { departmentId } : {}),
        ...(assignedToUserId !== UNSET_ASSIGNEE ? { assignedToUserId } : {}),
      });
      showSuccessToast(t("create.createSuccess"));
      router.push(`/${locale}/tickets/${ticket.id}`);
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("create.actionForbidden"),
          generic: t("create.createFailed"),
        }),
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
          <Select
            value={customerId}
            onValueChange={handleCustomerChange}
            disabled={customersQuery.isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  customersQuery.isLoading ? t("create.optionsLoading") : t("create.selectCustomer")
                }
              />
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

        {customerId && (
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            {t("create.contact")}
            <Select
              value={contactId}
              onValueChange={setContactId}
              disabled={customerDetailQuery.isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET_CONTACT}>{t("create.noContactOption")}</SelectItem>
                {(customerDetailQuery.data?.contacts ?? []).map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customerDetailQuery.isLoading && (
              <span className="text-xs text-slate-500">{t("create.optionsLoading")}</span>
            )}
            {customerDetailQuery.isError && (
              <span className="text-xs text-red-600">{t("create.contactsLoadError")}</span>
            )}
          </label>
        )}

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

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.department")}
          <Select
            value={departmentId}
            onValueChange={setDepartmentId}
            disabled={departmentsQuery.isLoading}
          >
            <SelectTrigger>
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
          {departmentsQuery.isLoading && (
            <span className="text-xs text-slate-500">{t("create.optionsLoading")}</span>
          )}
          {departmentsQuery.isError && (
            <span className="text-xs text-red-600">{t("create.departmentLoadError")}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.assignedAgent")}
          <Select
            value={assignedToUserId}
            onValueChange={setAssignedToUserId}
            disabled={usersQuery.isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET_ASSIGNEE}>{t("create.assignedAgentDefault")}</SelectItem>
              {(usersQuery.data ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {usersQuery.isLoading && (
            <span className="text-xs text-slate-500">{t("create.optionsLoading")}</span>
          )}
          {usersQuery.isError && (
            <span className="text-xs text-red-600">{t("create.assignedAgentLoadError")}</span>
          )}
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
