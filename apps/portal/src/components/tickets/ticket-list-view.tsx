"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateMyTicketMutation, useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Badge, Button, Input, Skeleton, showSuccessToast } from "@crm/ui";

/**
 * Story S-2 — maps a ticket status onto one of `@crm/ui`'s semantic `Badge`
 * variants, replacing the hand-rolled pill class string this file and
 * `ticket-detail-view.tsx` each carried their own copy of.
 *
 * The mapping stays in this app deliberately: `@crm/ui` holds primitives and
 * knows nothing about tickets, so `TicketStatus -> variant` is domain
 * knowledge that belongs to a consumer. Each variant resolves to exactly the
 * colours the pill already used (warning = amber tint, success = emerald,
 * secondary = slate, outline = bordered), so the only rendered difference is
 * `Badge`'s slightly wider padding and medium weight — which is precisely
 * what makes a portal status read identically to an agent-workspace one.
 */
function statusBadgeVariant(status: string): "warning" | "success" | "outline" | "secondary" {
  if (status === "OPEN") return "warning";
  if (status === "RESOLVED") return "success";
  if (status === "CLOSED") return "outline";
  return "secondary"; // IN_PROGRESS
}

/**
 * Story 53 — Customer Portal — Submit & Track Own Tickets. Mirrors
 * `apps/web`'s established loading/error/empty/populated card shape and
 * `AddDepartmentForm`'s "smallest UI surface for a one-field(ish) create"
 * convention — plain HTML/Tailwind, no shared UI component library exists
 * in `apps/portal` (Story 52 precedent).
 */
export function TicketListView() {
  const t = useTranslations("tickets");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const ticketsQuery = useMyTicketsQuery();

  return (
    <section className="flex flex-col gap-6">
      {/* Story 98 — p-4, not p-6: matches apps/web's own dominant card
          padding convention (see that app's data cards throughout). */}
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>

        {ticketsQuery.isLoading && (
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        )}

        {ticketsQuery.isError && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{t("list.error")}</span>
            <button
              type="button"
              onClick={() => ticketsQuery.refetch()}
              className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50 focus-ring"
            >
              {t("list.retry")}
            </button>
          </div>
        )}

        {ticketsQuery.isSuccess && ticketsQuery.data.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">{t("list.empty")}</p>
        )}

        {ticketsQuery.isSuccess && ticketsQuery.data.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {ticketsQuery.data.map((ticket) => (
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
                <span className="flex items-center gap-2 text-slate-500">
                  <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                  <span>{new Date(ticket.createdAt).toLocaleDateString(locale)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <CreateTicketForm />
    </section>
  );
}

function CreateTicketForm() {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateMyTicketMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        subject: subject.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
      });
      setSubject("");
      setCategory("");
      showSuccessToast(t("list.createSuccess"));
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("list.actionForbidden"),
          generic: t("list.createFailed"),
        }),
      );
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("list.createHeading")}</h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("list.createSubjectLabel")}
          <Input
            className="max-w-md"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("list.createCategoryLabel")}
          <Input
            className="max-w-md"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending || !subject.trim()} className="w-fit">
          {mutation.isPending ? t("list.createSubmitting") : t("list.createSubmit")}
        </Button>
      </form>
    </div>
  );
}
