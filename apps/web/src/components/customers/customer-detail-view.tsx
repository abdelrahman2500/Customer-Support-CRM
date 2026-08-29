"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCreateContactMutation,
  useCustomerQuery,
  useSetContactPortalPasswordMutation,
  useTicketsQuery,
  useUpdateContactMutation,
  useUpdateCustomerMutation,
} from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import type { ContactSummary } from "@/lib/tickets-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function priorityBadgeVariant(priority: string) {
  if (priority === "URGENT") return "destructive" as const;
  if (priority === "HIGH") return "warning" as const;
  return "secondary" as const;
}

/**
 * Story 30 — one existing contact's inline-editable fields. A dedicated
 * component (not inline in a `.map()`) because `useUpdateContactMutation`
 * is a hook and must be called once per component instance, not once per
 * loop iteration (React's rules of hooks) — the same constraint/precedent
 * `UnclaimedTicketRow` (Story 29, `dashboard-view.tsx`) already established.
 * Mirrors `TicketDetailView`'s blur-commit field convention: a field is only
 * sent to the real `PATCH /customers/:id/contacts/:contactId` when its
 * value actually changed on blur, and only ever a non-empty value for
 * `fullName`/`email` (an emptied `email` is not sent — `UpdateContactDto`'s
 * `@IsEmail()` would reject an empty string; no "clear this field" behavior
 * exists anywhere in this codebase, so none is invented here). `phone` has
 * no format constraint and may be cleared to blank.
 */
function ContactRow({ customerId, contact }: { customerId: string; contact: ContactSummary }) {
  const t = useTranslations("customers");
  const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const mutation = useUpdateContactMutation(customerId, contact.id);
  const portalPasswordMutation = useSetContactPortalPasswordMutation(customerId, contact.id);
  const [portalPasswordDraft, setPortalPasswordDraft] = useState("");
  const [portalPasswordSuccess, setPortalPasswordSuccess] = useState(false);

  function handleSetPortalPassword() {
    portalPasswordMutation.mutate(
      { newPassword: portalPasswordDraft },
      {
        onSuccess: () => {
          setPortalPasswordDraft("");
          setPortalPasswordSuccess(true);
        },
      },
    );
  }

  return (
    <li className="flex flex-col gap-1 border-b border-slate-100 pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          className="w-36"
          defaultValue={contact.fullName}
          aria-label={t("detail.contactFullNameLabel")}
          onChange={(event) => setFullNameDraft(event.target.value)}
          onBlur={() => {
            const value = fullNameDraft?.trim();
            if (value && fullNameDraft !== contact.fullName) {
              mutation.mutate({ fullName: value });
            }
          }}
        />
        <Input
          className="w-40"
          defaultValue={contact.email ?? ""}
          placeholder={t("detail.contactEmailLabel")}
          aria-label={t("detail.contactEmailLabel")}
          onChange={(event) => setEmailDraft(event.target.value)}
          onBlur={() => {
            const value = emailDraft?.trim();
            if (value && emailDraft !== (contact.email ?? "")) {
              mutation.mutate({ email: value });
            }
          }}
        />
        <Input
          className="w-32"
          defaultValue={contact.phone ?? ""}
          placeholder={t("detail.contactPhoneLabel")}
          aria-label={t("detail.contactPhoneLabel")}
          onChange={(event) => setPhoneDraft(event.target.value)}
          onBlur={() => {
            if (phoneDraft !== null && phoneDraft !== (contact.phone ?? "")) {
              mutation.mutate({ phone: phoneDraft });
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ isPrimary: !contact.isPrimary })}
        >
          {contact.isPrimary ? t("detail.unsetPrimary") : t("detail.setPrimary")}
        </Button>
        {contact.isPrimary && <Badge variant="outline">{t("detail.primaryContact")}</Badge>}
      </div>
      {mutation.isError && (
        <span className="text-xs text-red-600">
          {mutation.error instanceof ApiError && mutation.error.status === 403
            ? t("detail.actionForbidden")
            : t("detail.actionFailed")}
        </span>
      )}

      <div className="flex flex-col gap-1 border-t border-slate-200 pt-2 sm:w-full">
        <span className="text-xs text-slate-500">{t("detail.portalPasswordLabel")}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-40"
            type="password"
            placeholder={t("detail.portalPasswordPlaceholder")}
            value={portalPasswordDraft}
            onChange={(event) => {
              setPortalPasswordDraft(event.target.value);
              setPortalPasswordSuccess(false);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={portalPasswordDraft.length < 8 || portalPasswordMutation.isPending}
            onClick={handleSetPortalPassword}
          >
            {portalPasswordMutation.isPending
              ? t("detail.portalPasswordSubmitting")
              : t("detail.portalPasswordSubmit")}
          </Button>
        </div>
        {portalPasswordSuccess && (
          <p className="text-xs text-emerald-600">{t("detail.portalPasswordSuccess")}</p>
        )}
        {portalPasswordMutation.isError && (
          <p className="text-xs text-red-600">
            {portalPasswordMutation.error instanceof ApiError
              ? portalPasswordMutation.error.message
              : t("detail.actionFailed")}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Story 30 — the add-contact form, mirroring `CreateCustomerView`'s plain
 * `useState` shape (no form/validation library). Never optimistic: on
 * success, the existing `useCreateContactMutation` invalidation refreshes
 * the customer detail query, and the new contact appears via the real
 * re-fetched `contacts` array above — no optimistic row is ever inserted.
 */
function AddContactForm({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateContactMutation(customerId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        fullName,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(isPrimary ? { isPrimary: true } : {}),
      });
      setFullName("");
      setEmail("");
      setPhone("");
      setIsPrimary(false);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("detail.addContactFailed"));
    }
  }

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("detail.contactFullNameLabel")}
        <Input
          className="w-36"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          minLength={1}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("detail.contactEmailLabel")}
        <Input className="w-40" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("detail.contactPhoneLabel")}
        <Input className="w-32" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(event) => setIsPrimary(event.target.checked)}
        />
        {t("detail.primaryContact")}
      </label>
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? t("detail.addContactSubmitting") : t("detail.addContactSubmit")}
      </Button>
      {error && <Alert variant="destructive" className="w-full">{error}</Alert>}
    </form>
  );
}

/**
 * Story 26 — Customer Detail. Mirrors `TicketDetailView`'s structure: a
 * loading/error/content shape, the same 404-vs-generic error distinction,
 * and a bordered card per section.
 *
 * Story 27 — adds a "Related tickets" card, derived by filtering the
 * existing, already-fetched, unpaginated `GET /tickets` result client-side
 * by `customerId` (plan Design item 1 — no backend `customerId` filter
 * parameter is introduced), plus a "New ticket" action that deep-links to
 * `tickets/new?customerId=<id>` (plan Design item 5).
 *
 * Story 30 — replaces the previously read-only header/contacts with real
 * edit capability over the existing `PATCH /customers/:id` and
 * `POST/PATCH /customers/:id/contacts` contracts (no new backend). Never
 * optimistic: every field commits only on blur/submit and only ever
 * reflects the real, re-fetched server state afterward.
 *
 * Story 52 — `ContactRow` gains an inline "set portal password" control
 * (commits on click, not blur — mirrors `UserRow`'s password-reset UI
 * exactly), the only way a Contact gets Customer Portal access.
 */
export function CustomerDetailView({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const customerQuery = useCustomerQuery(customerId);
  const ticketsQuery = useTicketsQuery({});
  const relatedTickets = (ticketsQuery.data ?? []).filter(
    (ticket) => ticket.customerId === customerId,
  );
  const updateCustomerMutation = useUpdateCustomerMutation(customerId);
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);

  if (customerQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (customerQuery.isError) {
    const notFound = customerQuery.error instanceof ApiError && customerQuery.error.status === 404;
    return (
      <Alert variant="destructive">{notFound ? t("detail.notFound") : t("detail.loadError")}</Alert>
    );
  }

  const customer = customerQuery.data;
  if (!customer) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            className="w-56 text-lg font-semibold"
            defaultValue={customer.displayName}
            aria-label={t("detail.displayNameLabel")}
            onChange={(event) => setDisplayNameDraft(event.target.value)}
            onBlur={() => {
              const value = displayNameDraft?.trim();
              if (value && displayNameDraft !== customer.displayName) {
                updateCustomerMutation.mutate({ displayName: value });
              }
            }}
          />
          <Select
            value={customer.isActive ? "active" : "inactive"}
            onValueChange={(value) => updateCustomerMutation.mutate({ isActive: value === "active" })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("list.active")}</SelectItem>
              <SelectItem value="inactive">{t("list.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/${locale}/tickets/new?customerId=${customerId}`)}
        >
          {t("detail.newTicketButton")}
        </Button>
      </div>

      {updateCustomerMutation.isError && (
        <Alert variant="destructive">
          {updateCustomerMutation.error instanceof ApiError && updateCustomerMutation.error.status === 403
            ? t("detail.actionForbidden")
            : t("detail.actionFailed")}
        </Alert>
      )}

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.contactsHeading")}</h2>
        {customer.contacts.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.contactsEmpty")}</p>
        )}
        {customer.contacts.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {customer.contacts.map((contact) => (
              <ContactRow key={contact.id} customerId={customerId} contact={contact} />
            ))}
          </ul>
        )}
        <AddContactForm customerId={customerId} />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.ticketsHeading")}</h2>
        {ticketsQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {ticketsQuery.isError && (
          <Alert variant="destructive" className="mt-2">
            {t("detail.ticketsError")}
          </Alert>
        )}
        {ticketsQuery.isSuccess && relatedTickets.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.ticketsEmpty")}</p>
        )}
        {ticketsQuery.isSuccess && relatedTickets.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {relatedTickets.map((ticket) => (
              <li
                key={ticket.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-2"
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    router.push(`/${locale}/tickets/${ticket.id}`);
                  }
                }}
              >
                <span className="font-medium text-slate-800">{ticket.subject}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{ticket.status}</Badge>
                  <Badge variant={priorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
                  <span className="text-slate-500">
                    {new Date(ticket.createdAt).toLocaleDateString(locale)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
