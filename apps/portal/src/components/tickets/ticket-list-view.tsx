"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateMyTicketMutation, useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { ApiError } from "@/lib/api";

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
      <div className="rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>

        {ticketsQuery.isLoading && (
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        )}

        {ticketsQuery.isError && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{t("list.error")}</span>
            <button
              type="button"
              onClick={() => ticketsQuery.refetch()}
              className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50"
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
                  <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                    {ticket.status}
                  </span>
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
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("list.createFailed"));
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">{t("list.createHeading")}</h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("list.createSubjectLabel")}
          <input
            className="flex h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("list.createCategoryLabel")}
          <input
            className="flex h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={mutation.isPending || !subject.trim()}
          className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? t("list.createSubmitting") : t("list.createSubmit")}
        </button>
      </form>
    </div>
  );
}
