"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCustomersQuery,
  useTicketHistoryQuery,
  useTicketQuery,
  useTicketSlaTargetQuery,
  useUpdateTicketMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useTicketRealtime } from "@/hooks/use-ticket-realtime";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { ApiError } from "@/lib/api";
import type { TicketPriority, TicketStatus } from "@/lib/tickets-api";
import { Badge } from "@/components/ui/badge";
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

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/**
 * Story 23 — Ticket Detail (plan Task 8). Reads `GET /tickets/:id`,
 * `/history`, and `/sla-target` (the last tolerating a 404 as "no SLA
 * target" — `getTicketSlaTarget`, not an error state). Actions (status,
 * priority, category, assignment) all go through the single existing
 * `PATCH /tickets/:id` — a rejected mutation renders inline (Design item 5:
 * never assumed to succeed) and never optimistically applies. Joins
 * `ticket:{id}` (Story 20) via `useTicketRealtime` — no other room.
 */
export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  useTicketRealtime(ticketId);

  const ticketQuery = useTicketQuery(ticketId);
  const historyQuery = useTicketHistoryQuery(ticketId);
  const slaTargetQuery = useTicketSlaTargetQuery(ticketId);
  const customersQuery = useCustomersQuery();
  const usersQuery = useUsersQuery();
  const mutation = useUpdateTicketMutation(ticketId);

  const [categoryDraft, setCategoryDraft] = useState<string | null>(null);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customersQuery.data ?? []) {
      map.set(customer.id, customer.displayName);
    }
    return map;
  }, [customersQuery.data]);

  if (ticketQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (ticketQuery.isError) {
    const notFound = ticketQuery.error instanceof ApiError && ticketQuery.error.status === 404;
    return (
      <Alert variant="destructive">{notFound ? t("detail.notFound") : t("detail.loadError")}</Alert>
    );
  }

  const ticket = ticketQuery.data;
  if (!ticket) {
    return null;
  }
  const slaStatus = deriveSlaStatus(slaTargetQuery.data ?? null);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{ticket.subject}</h1>
        <p className="text-sm text-slate-500">
          {t("detail.customer")}:{" "}
          <button
            type="button"
            className="hover:underline"
            onClick={() => router.push(`/${locale}/customers/${ticket.customerId}`)}
          >
            {customerNameById.get(ticket.customerId) ?? ticket.customerId}
          </button>
        </p>
      </div>

      {mutation.isError && (
        <Alert variant="destructive">
          {mutation.error instanceof ApiError && mutation.error.status === 403
            ? t("detail.actionForbidden")
            : t("detail.actionFailed")}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("detail.status")}>
          <Select
            value={ticket.status}
            onValueChange={(value) => mutation.mutate({ status: value as TicketStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("detail.priority")}>
          <Select
            value={ticket.priority}
            onValueChange={(value) => mutation.mutate({ priority: value as TicketPriority })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("detail.category")}>
          <Input
            defaultValue={ticket.category ?? ""}
            onChange={(event) => setCategoryDraft(event.target.value)}
            onBlur={() => {
              if (categoryDraft !== null && categoryDraft !== (ticket.category ?? "")) {
                mutation.mutate({ category: categoryDraft });
              }
            }}
          />
        </Field>

        <Field label={t("detail.assignedAgent")}>
          <Select
            value={ticket.assignedToUserId ?? undefined}
            onValueChange={(value) => mutation.mutate({ assignedToUserId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("list.unassigned")} />
            </SelectTrigger>
            <SelectContent>
              {(usersQuery.data ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.slaHeading")}</h2>
        {slaTargetQuery.isLoading && <Skeleton className="mt-2 h-5 w-40" />}
        {slaTargetQuery.isSuccess && slaStatus.kind === "none" && (
          <p className="mt-1 text-sm text-slate-500">{t("sla.none")}</p>
        )}
        {slaTargetQuery.isSuccess && slaStatus.kind === "breached" && (
          <Badge variant="destructive" className="mt-2">
            {t("sla.breachedAt", { time: new Date(slaStatus.targetAt).toLocaleString(locale) })}
          </Badge>
        )}
        {slaTargetQuery.isSuccess && slaStatus.kind === "on-track" && (
          <p className="mt-1 text-sm text-slate-700">
            {t("sla.remaining", { time: formatRemaining(slaStatus.remainingMs) })}
          </p>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.historyHeading")}</h2>
        {historyQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
        {historyQuery.isError && <Alert variant="destructive" className="mt-2">{t("detail.historyError")}</Alert>}
        {historyQuery.isSuccess && historyQuery.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.historyEmpty")}</p>
        )}
        {historyQuery.isSuccess && historyQuery.data.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {historyQuery.data.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-800">{entry.eventType}</span>
                <span className="text-slate-500">{new Date(entry.createdAt).toLocaleString(locale)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      {children}
    </label>
  );
}
