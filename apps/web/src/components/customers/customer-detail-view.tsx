"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import {
  useAnonymizeCustomerMutation,
  useCreateContactMutation,
  useCreateCustomerNoteMutation,
  useCustomerNotesQuery,
  useCustomerQuery,
  useRevokeContactPortalAccessMutation,
  useSetContactPortalPasswordMutation,
  useTicketsQuery,
  useUpdateContactMutation,
  useUpdateCustomerMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { AttachmentsCard } from "@/components/attachments/attachments-card";
import { ApiError } from "@/lib/api";
import type { ContactSummary } from "@/lib/tickets-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Pagination,
  SectionCard,
  Skeleton,
  Textarea,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ticketPriorityBadgeVariant, ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";

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
  const errorMessage = useErrorMessage();
  const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const mutation = useUpdateContactMutation(customerId, contact.id);
  const portalPasswordMutation = useSetContactPortalPasswordMutation(customerId, contact.id);
  const [portalPasswordDraft, setPortalPasswordDraft] = useState("");
  const [portalPasswordSuccess, setPortalPasswordSuccess] = useState(false);
  // Story 94 — setting a contact's portal password immediately invalidates
  // whatever they currently sign in with, same as an agent's own password
  // reset (`UserRow`) — now requires confirmation, and its error branch,
  // which previously had no 403 check at all, is normalized like every
  // sibling mutation on this page.
  const [confirmPortalPasswordOpen, setConfirmPortalPasswordOpen] = useState(false);

  function confirmSetPortalPassword() {
    portalPasswordMutation.mutate(
      { newPassword: portalPasswordDraft },
      {
        onSuccess: () => {
          setPortalPasswordDraft("");
          setPortalPasswordSuccess(true);
          setConfirmPortalPasswordOpen(false);
        },
      },
    );
  }

  // Story 100 — revocation, mirroring the set-password control's exact
  // destructive-confirm shape immediately above.
  const revokeMutation = useRevokeContactPortalAccessMutation(customerId, contact.id);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  function confirmRevokePortalAccess() {
    revokeMutation.mutate(undefined, { onSuccess: () => setConfirmRevokeOpen(false) });
  }

  return (
    <li className="flex flex-col gap-1 border-b border-rule-subtle pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
        <span className="text-xs text-danger-foreground">
          {errorMessage(mutation.error, {
            forbidden: t("detail.actionForbidden"),
            generic: t("detail.actionFailed"),
          })}
        </span>
      )}

      <div className="flex flex-col gap-1 border-t border-rule pt-2 sm:w-full">
        <span className="text-xs text-ink-subtle">{t("detail.portalPasswordLabel")}</span>
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
          {/* Story 98 — Design System & Visual Polish. Mirrors
              UserRow's own password-reset button: this is genuinely
              irreversible and its ConfirmDialog already renders a
              destructive confirm button, so the trigger now agrees. */}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={portalPasswordDraft.length < 8 || portalPasswordMutation.isPending}
            onClick={() => setConfirmPortalPasswordOpen(true)}
          >
            {portalPasswordMutation.isPending
              ? t("detail.portalPasswordSubmitting")
              : t("detail.portalPasswordSubmit")}
          </Button>
          <ConfirmDialog
            open={confirmPortalPasswordOpen}
            onOpenChange={setConfirmPortalPasswordOpen}
            title={t("detail.portalPasswordConfirmTitle")}
            description={t("detail.portalPasswordConfirmDescription")}
            confirmLabel={t("detail.portalPasswordSubmit")}
            onConfirm={confirmSetPortalPassword}
            isPending={portalPasswordMutation.isPending}
          />
        </div>
        {portalPasswordSuccess && (
          <p className="text-xs text-emerald-600">{t("detail.portalPasswordSuccess")}</p>
        )}
        {portalPasswordMutation.isError && (
          <p className="text-xs text-danger-foreground">
            {errorMessage(portalPasswordMutation.error, {
              forbidden: t("detail.actionForbidden"),
              generic: t("detail.actionFailed"),
            })}
          </p>
        )}
        {/* Story 100 — shown only when there is something to revoke;
            mirrors the set-password control's own destructive-confirm
            shape immediately above. */}
        {contact.hasPortalAccess && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{t("detail.portalAccessGranted")}</Badge>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={revokeMutation.isPending}
              onClick={() => setConfirmRevokeOpen(true)}
            >
              {revokeMutation.isPending
                ? t("detail.revokePortalAccessSubmitting")
                : t("detail.revokePortalAccessSubmit")}
            </Button>
            <ConfirmDialog
              open={confirmRevokeOpen}
              onOpenChange={setConfirmRevokeOpen}
              title={t("detail.revokePortalAccessConfirmTitle")}
              description={t("detail.revokePortalAccessConfirmDescription")}
              confirmLabel={t("detail.revokePortalAccessSubmit")}
              onConfirm={confirmRevokePortalAccess}
              isPending={revokeMutation.isPending}
            />
          </div>
        )}
        {revokeMutation.isError && (
          <p className="text-xs text-danger-foreground">
            {errorMessage(revokeMutation.error, {
              forbidden: t("detail.actionForbidden"),
              generic: t("detail.actionFailed"),
            })}
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
  const errorMessage = useErrorMessage();
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
      setError(
        errorMessage(submitError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.addContactFailed"),
        }),
      );
    }
  }

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t("detail.contactFullNameLabel")}
        <Input
          className="w-36"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          minLength={1}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t("detail.contactEmailLabel")}
        <Input className="w-40" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t("detail.contactPhoneLabel")}
        <Input className="w-32" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      {/* Batch 6 (UX audit) — the shared `Checkbox`/`Label` pair, replacing
          a raw `<input type="checkbox">` with no focus-ring/keyboard parity
          with the rest of the app. */}
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={`add-contact-primary-${customerId}`}
          checked={isPrimary}
          onCheckedChange={(checked) => setIsPrimary(checked === true)}
        />
        <Label
          htmlFor={`add-contact-primary-${customerId}`}
          className="text-xs font-normal text-ink-muted"
        >
          {t("detail.primaryContact")}
        </Label>
      </div>
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? t("detail.addContactSubmitting") : t("detail.addContactSubmit")}
      </Button>
      {error && (
        <Alert variant="destructive" className="w-full">
          {error}
        </Alert>
      )}
    </form>
  );
}

/**
 * RM-02 — the smallest UI surface for a one-field create (mirrors
 * `TicketDetailView`'s own `AddNoteForm` exactly): an inline textarea +
 * submit button below the notes list, never optimistic — a successful
 * `POST /customers/:id/notes` invalidates the notes query and the real,
 * re-fetched list is what renders the new note.
 */
function AddCustomerNoteForm({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const errorMessage = useErrorMessage();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateCustomerNoteMutation(customerId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ body: body.trim() });
      setBody("");
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.notesCreateFailed"),
        }),
      );
    }
  }

  return (
    <form className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="customer-note-body">
        {t("detail.notesPlaceholder")}
      </label>
      <Textarea
        id="customer-note-body"
        rows={3}
        value={body}
        placeholder={t("detail.notesPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
      />
      <div>
        <Button type="submit" size="sm" disabled={mutation.isPending || !body.trim()}>
          {mutation.isPending ? t("detail.notesSubmitting") : t("detail.notesSubmit")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
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
 *
 * Story 67 — a new Attachments card, appended last, reusing the exact
 * `AttachmentsCard` component `TicketDetailView` (Story 66) already built
 * — the same shared list-plus-upload-form shape, parametrized to
 * `{ type: "customer", id: customerId }`.
 *
 * Story S-8d — supersedes Story 27's client-side derivation of Related
 * Tickets. The backend `customerId` filter Story 27 explicitly declined
 * to add now exists, so this card asks for the customer's tickets
 * directly. Same rendered result, minus the dependency on the whole
 * ticket list being present in one response.
 */
/**
 * Story 97 — Loading & Skeleton UX. Replaces the previous generic
 * two-block skeleton with one shaped to match the real layout: the
 * editable display-name/status header, the Contacts card, the Related
 * Tickets card, and the Attachments card. Exported so
 * `app/[locale]/(agent)/customers/[id]/loading.tsx` can render the
 * identical shape during the route transition itself.
 */
export function CustomerDetailSkeleton() {
  return (
    <section className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      {["contacts", "tickets", "notes", "attachments"].map((section) => (
        <Card key={section} className="p-surface">
          <Skeleton className="h-4 w-32" />
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
      ))}
    </section>
  );
}

export function CustomerDetailView({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const ticketLabels = useTicketLabels();
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const customerQuery = useCustomerQuery(customerId);
  /**
   * Story S-8d — asks the server for this customer's tickets instead of
   * fetching the branch-wide list and filtering it here. The old shape
   * returned the newest 500 tickets branch-wide, so a customer whose
   * tickets fell outside that window appeared to have none at all.
   */
  /** Story S-8e — this card renders the server's own `createdAt` order
   * with no client-side re-sort, so paging it is exact: page 2 really is
   * the next 25 tickets. Its own page state, independent of anything else
   * on the screen. */
  const [ticketsPage, setTicketsPage] = useState(1);
  const ticketsQuery = useTicketsQuery({ customerId, page: ticketsPage });
  const relatedTicketsPage = ticketsQuery.data;
  const relatedTickets = relatedTicketsPage?.items ?? [];
  const updateCustomerMutation = useUpdateCustomerMutation(customerId);
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  /** Story 159 — the display name is a heading until an agent chooses to edit it. */
  const [editingName, setEditingName] = useState(false);
  // RM-02 — Customer Notes.
  const notesQuery = useCustomerNotesQuery(customerId);
  const usersQuery = useUsersQuery();
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  if (customerQuery.isLoading) {
    return <CustomerDetailSkeleton />;
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
      {/* Batch 3 (UX audit) — mirrors the portal's own `detail.backToList`
          pattern exactly (this screen never had one). `rtl:rotate-180` so
          "back" points the way back in both directions; `aria-hidden`
          since the adjacent label already names the action. */}
      <Link
        href={`/${locale}/customers`}
        className="focus-ring self-start rounded-sm text-sm font-medium text-ink-muted hover:text-ink hover:underline"
      >
        <span aria-hidden="true" className="inline-block rtl:rotate-180">
          &larr;
        </span>{" "}
        {t("detail.backToList")}
      </Link>

      {/* Story 159 — a real, visible page title, adopting Story 156's
          ticket-detail pattern.

          NAV-2 added an `sr-only` h1 because the name was an
          always-editable `Input`, so the page had no visible heading at
          all — the right accessibility patch for a layout problem it could
          not fix. The page read as a form rather than a record, and its
          most important text was the one thing not rendered as text.

          The name is still editable through the same `PATCH`, with the
          same blur-commit and the same revert-on-error; editing is now an
          explicit mode instead of the permanent state. The `h1` carries
          the name in both modes, so the document outline never depends on
          which mode is active. `flex-wrap` keeps a long name from pushing
          the status `Select` and the New Ticket action off a narrow
          screen. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {editingName ? (
            <>
              <h1 className="sr-only">{customer.displayName}</h1>
              <Input
                autoFocus
                className="w-56 text-lg font-semibold"
                // Batch 5 (UX audit) — controlled (not `defaultValue`) so a
                // rejected edit can be explicitly reverted, mirroring
                // `SlaPolicyRow`'s own blur-commit-with-revert-on-error pattern.
                value={displayNameDraft ?? customer.displayName}
                aria-label={t("detail.displayNameLabel")}
                onChange={(event) => setDisplayNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Escape abandons the edit; the draft resets so reopening
                  // starts from the server's value, never a stale keystroke.
                  if (event.key === "Escape") {
                    setDisplayNameDraft(customer.displayName);
                    setEditingName(false);
                  }
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  const value = displayNameDraft?.trim();
                  if (value && displayNameDraft !== customer.displayName) {
                    updateCustomerMutation.mutate(
                      { displayName: value },
                      { onError: () => setDisplayNameDraft(customer.displayName) },
                    );
                  }
                  setEditingName(false);
                }}
              />
            </>
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-ink">{customer.displayName}</h1>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                {t("detail.displayNameEdit")}
              </Button>
            </div>
          )}
          <Select
            value={customer.isActive ? "active" : "inactive"}
            disabled={updateCustomerMutation.isPending}
            onValueChange={(value) =>
              updateCustomerMutation.mutate({ isActive: value === "active" })
            }
          >
            <SelectTrigger className="w-32" aria-label={t("list.filterStatus")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("list.active")}</SelectItem>
              <SelectItem value="inactive">{t("list.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="shrink-0" asChild>
          <Link href={`/${locale}/tickets/new?customerId=${customerId}`}>
            {t("detail.newTicketButton")}
          </Link>
        </Button>
      </div>

      {updateCustomerMutation.isError && (
        <Alert variant="destructive">
          {errorMessage(updateCustomerMutation.error, {
            forbidden: t("detail.actionForbidden"),
            generic: t("detail.actionFailed"),
          })}
        </Alert>
      )}

      {/* Story 159 — a two-column workspace on desktop, one column below `lg`.

          Adopts Story 156's ticket-detail split. The five sections divide
          cleanly by what an agent does with them: tickets and notes are the
          working record of this customer and get the wide column; contacts,
          attachments and the irreversible anonymize control are reference
          and administration, and sit beside it. Below `lg` the grid
          collapses to one column and the main column still comes first, so
          nothing is buried on a phone. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <SectionCard title={t("detail.ticketsHeading")}>
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
              <p className="mt-2 text-sm text-ink-subtle">{t("detail.ticketsEmpty")}</p>
            )}
            {ticketsQuery.isSuccess && relatedTickets.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {relatedTickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex cursor-pointer items-center justify-between border-b border-rule-subtle pb-2"
                    onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
                  >
                    <Link
                      href={`/${locale}/tickets/${ticket.id}`}
                      className="focus-ring rounded-sm font-medium text-ink-strong hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {ticket.subject}
                    </Link>
                    <span className="flex items-center gap-2">
                      <Badge variant={ticketStatusBadgeVariant(ticket.status)}>
                        {ticketLabels.status(ticket.status)}
                      </Badge>
                      <Badge variant={ticketPriorityBadgeVariant(ticket.priority)}>
                        {ticketLabels.priority(ticket.priority)}
                      </Badge>
                      <span className="text-ink-subtle">
                        {new Date(ticket.createdAt).toLocaleDateString(locale)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Story S-8e — renders nothing until this customer actually has
                more than one page of tickets, so the common case is unchanged. */}
            {relatedTicketsPage !== undefined && (
              <Pagination
                page={relatedTicketsPage.page}
                totalPages={relatedTicketsPage.totalPages}
                onPageChange={setTicketsPage}
                disabled={ticketsQuery.isPlaceholderData}
                label={tCommon("pagination.label")}
                previousLabel={tCommon("pagination.previous")}
                nextLabel={tCommon("pagination.next")}
                indicator={tCommon("pagination.indicator", {
                  page: relatedTicketsPage.page,
                  totalPages: relatedTicketsPage.totalPages,
                })}
              />
            )}
          </SectionCard>

          <SectionCard title={t("detail.notesHeading")}>
            {notesQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
            {notesQuery.isError && (
              <Alert variant="destructive" className="mt-2">
                {t("detail.notesError")}
              </Alert>
            )}
            {notesQuery.isSuccess && notesQuery.data.length === 0 && (
              <p className="mt-2 text-sm text-ink-subtle">{t("detail.notesEmpty")}</p>
            )}
            {notesQuery.isSuccess && notesQuery.data.length > 0 && (
              <ol className="mt-2 flex flex-col gap-2 text-sm">
                {notesQuery.data.map((note) => (
                  <li key={note.id} className="border-b border-rule-subtle pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink-strong">
                        {userNameById.get(note.authorUserId) ?? note.authorUserId}
                      </span>
                      <span className="text-ink-subtle">
                        {new Date(note.createdAt).toLocaleString(locale)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-ink-strong">{note.body}</p>
                  </li>
                ))}
              </ol>
            )}
            <AddCustomerNoteForm customerId={customerId} />
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard title={t("detail.contactsHeading")}>
            {customer.contacts.length === 0 && (
              <p className="mt-2 text-sm text-ink-subtle">{t("detail.contactsEmpty")}</p>
            )}
            {customer.contacts.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {customer.contacts.map((contact) => (
                  <ContactRow key={contact.id} customerId={customerId} contact={contact} />
                ))}
              </ul>
            )}
            <AddContactForm customerId={customerId} />
          </SectionCard>

          <AttachmentsCard
            owner={{ type: "customer", id: customerId }}
            locale={locale}
            strings={{
              heading: t("detail.attachmentsHeading"),
              error: t("detail.attachmentsError"),
              empty: t("detail.attachmentsEmpty"),
              uploading: t("detail.attachmentsUploading"),
              uploadFailedFallback: t("detail.attachmentsUploadFailed"),
              uploadForbidden: t("detail.actionForbidden"),
            }}
          />

          <AnonymizeCustomerCard customerId={customerId} anonymizedAt={customer.anonymizedAt} />
        </div>
      </div>
    </section>
  );
}

/**
 * Story 132 — Customer Data Anonymization / Right-to-Erasure.
 *
 * Deliberately its own card at the very end of the screen, not another
 * control in the header row beside the display-name input and the
 * active/inactive `Select`. Those two are ordinary, reversible edits; this
 * is irreversible, and placing it next to them would invite exactly the
 * misclick it must not allow.
 *
 * Mirrors the revoke-portal-access control's shape (destructive `Button` +
 * shared `ConfirmDialog` + inline `useErrorMessage` alert), which is this
 * codebase's established pattern for a guarded, consequential action.
 *
 * No client-side permission gating: `AuthenticatedUser`/the JWT claims
 * carry `roles`, never `permissions`, and this app has never gated UI on
 * permissions (see `nav-items.tsx`'s own doc comment, and Story 129). A
 * caller without `customer:anonymize` sees the button, and the real 403
 * from the API surfaces through `errorMessage(..., { forbidden })` below.
 * The API is the authoritative boundary.
 */
function AnonymizeCustomerCard({
  customerId,
  anonymizedAt,
}: {
  customerId: string;
  anonymizedAt: string | null;
}) {
  const t = useTranslations("customers");
  const { locale } = useParams<{ locale: string }>();
  const errorMessage = useErrorMessage();
  const mutation = useAnonymizeCustomerMutation(customerId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Already anonymized: show the durable record, and withhold the action
  // entirely. There is no un-anonymize, so re-offering it would only ever
  // be a no-op the user could misread as a second, different operation.
  if (anonymizedAt) {
    return (
      <SectionCard title={t("detail.anonymizeHeading")}>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{t("detail.anonymizedBadge")}</Badge>
          <span className="text-ink-subtle">{new Date(anonymizedAt).toLocaleString(locale)}</span>
        </div>
        <p className="mt-2 text-sm text-ink-subtle">{t("detail.anonymizedRetentionNote")}</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t("detail.anonymizeHeading")}>
      <p className="mt-2 text-sm text-ink-subtle">{t("detail.anonymizeDescription")}</p>
      <div className="mt-3">
        <Button
          variant="destructive"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {mutation.isPending ? t("detail.anonymizeSubmitting") : t("detail.anonymizeSubmit")}
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("detail.anonymizeConfirmTitle")}
          description={t("detail.anonymizeConfirmDescription")}
          confirmLabel={t("detail.anonymizeSubmit")}
          onConfirm={() => mutation.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })}
          isPending={mutation.isPending}
        />
      </div>
      {mutation.isError && (
        <Alert variant="destructive" className="mt-2">
          {errorMessage(mutation.error, {
            forbidden: t("detail.anonymizeForbidden"),
            generic: t("detail.anonymizeFailed"),
          })}
        </Alert>
      )}
    </SectionCard>
  );
}
