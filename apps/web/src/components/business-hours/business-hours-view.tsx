"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useBusinessHoursCalendarQuery,
  useCreateBusinessHoursCalendarMutation,
  useCreateBusinessHoursExceptionMutation,
  useUpdateBusinessHoursCalendarMutation,
  useUpdateBusinessHoursExceptionMutation,
} from "@/hooks/use-business-hours";
import type {
  BusinessHoursCalendar,
  BusinessHoursDay,
  BusinessHoursDayInput,
  BusinessHoursException,
} from "@/lib/business-hours-api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** A UX starting point only — the agent must still review and submit the
 * create form; nothing here is auto-submitted, so this is not an invented
 * business rule (plan Design item 6). */
const DEFAULT_DAYS: BusinessHoursDay[] = WEEKDAY_KEYS.map((_, weekday) => {
  const isWeekend = weekday === 0 || weekday === 6;
  return {
    weekday,
    isOpen: !isWeekend,
    startMinute: isWeekend ? null : 9 * 60,
    endMinute: isWeekend ? null : 17 * 60,
  };
});

function minutesToTime(minutes: number | null): string {
  if (minutes === null) {
    return "";
  }
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function timeToMinutes(value: string): number | null {
  if (!value) {
    return null;
  }
  const [hours, mins] = value.split(":").map(Number);
  if (hours === undefined || mins === undefined || Number.isNaN(hours) || Number.isNaN(mins)) {
    return null;
  }
  return hours * 60 + mins;
}

function toDayInputs(days: BusinessHoursDay[]): BusinessHoursDayInput[] {
  return days.map((day) => ({
    weekday: day.weekday,
    isOpen: day.isOpen,
    ...(day.isOpen && day.startMinute !== null ? { startMinute: day.startMinute } : {}),
    ...(day.isOpen && day.endMinute !== null ? { endMinute: day.endMinute } : {}),
  }));
}

function DaysGrid({
  days,
  onChange,
}: {
  days: BusinessHoursDay[];
  onChange: (weekday: number, patch: Partial<BusinessHoursDay>) => void;
}) {
  const t = useTranslations("businessHours");
  return (
    <div className="mt-2 flex flex-col gap-2">
      {days
        .slice()
        .sort((a, b) => a.weekday - b.weekday)
        .map((day) => (
          <div key={day.weekday} className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-sm font-medium text-slate-700">
              {t(`weekday.${WEEKDAY_KEYS[day.weekday]}`)}
            </span>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={day.isOpen}
                onChange={(event) => {
                  const isOpen = event.target.checked;
                  onChange(
                    day.weekday,
                    isOpen
                      ? { isOpen, startMinute: day.startMinute ?? 9 * 60, endMinute: day.endMinute ?? 17 * 60 }
                      : { isOpen, startMinute: null, endMinute: null },
                  );
                }}
              />
              {t("openLabel")}
            </label>
            {day.isOpen && (
              <>
                <Input
                  type="time"
                  className="w-28"
                  value={minutesToTime(day.startMinute)}
                  aria-label={t("startLabel")}
                  onChange={(event) => onChange(day.weekday, { startMinute: timeToMinutes(event.target.value) })}
                />
                <Input
                  type="time"
                  className="w-28"
                  value={minutesToTime(day.endMinute)}
                  aria-label={t("endLabel")}
                  onChange={(event) => onChange(day.weekday, { endMinute: timeToMinutes(event.target.value) })}
                />
              </>
            )}
          </div>
        ))}
    </div>
  );
}

/** Story 33 — shown only when `GET /business-hours-calendars` genuinely 404s
 * (no calendar exists for this branch yet) — a real, expected state, not an
 * error. Pre-filled with an editable, non-submitted default. */
function CreateCalendarForm() {
  const t = useTranslations("businessHours");
  const [days, setDays] = useState<BusinessHoursDay[]>(DEFAULT_DAYS);
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateBusinessHoursCalendarMutation();

  function updateDay(weekday: number, patch: Partial<BusinessHoursDay>) {
    setDays((current) => current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ days: toDayInputs(days) });
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("createFailed"));
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("createHeading")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("createPrompt")}</p>
      {error && (
        <Alert variant="destructive" className="mt-2">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <DaysGrid days={days} onChange={updateDay} />
        <Button type="submit" size="sm" className="mt-3" disabled={mutation.isPending}>
          {mutation.isPending ? t("createSubmitting") : t("createButton")}
        </Button>
      </form>
    </div>
  );
}

/** Story 33 — one explicit "Save schedule" action submitting the complete
 * 7-entry draft, not per-field blur-commit (plan Design item 2): the
 * backend replaces the whole array atomically and rejects an
 * internally-inconsistent partial state, so auto-committing on every
 * field's blur would repeatedly resend a genuinely invalid in-progress
 * array while an agent is still filling in a day. */
function WeeklyScheduleEditor({ calendar }: { calendar: BusinessHoursCalendar }) {
  const t = useTranslations("businessHours");
  const [days, setDays] = useState<BusinessHoursDay[]>(calendar.days);
  const mutation = useUpdateBusinessHoursCalendarMutation();

  function updateDay(weekday: number, patch: Partial<BusinessHoursDay>) {
    setDays((current) => current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("scheduleHeading")}</h2>
      <DaysGrid days={days} onChange={updateDay} />
      <Button
        type="button"
        size="sm"
        className="mt-3"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ days: toDayInputs(days) })}
      >
        {mutation.isPending ? t("saving") : t("saveButton")}
      </Button>
      {mutation.isError && (
        <Alert variant="destructive" className="mt-2">
          {mutation.error instanceof ApiError && mutation.error.status === 403
            ? t("actionForbidden")
            : t("actionFailed")}
        </Alert>
      )}
    </div>
  );
}

/** Story 33 — one existing exception's inline-editable fields. A dedicated
 * component (not inline in a `.map()`) because
 * `useUpdateBusinessHoursExceptionMutation` is a hook and must be called
 * once per component instance, not once per loop iteration — the same
 * constraint `ContactRow`/`SlaPolicyRow`/`UnclaimedTicketRow` already
 * established elsewhere in this codebase. */
function ExceptionRow({ exception }: { exception: BusinessHoursException }) {
  const t = useTranslations("businessHours");
  const mutation = useUpdateBusinessHoursExceptionMutation(exception.id);
  const [startDraft, setStartDraft] = useState(minutesToTime(exception.overrideStartMinute));
  const [endDraft, setEndDraft] = useState(minutesToTime(exception.overrideEndMinute));

  function toggleClosed() {
    if (!exception.isClosed) {
      mutation.mutate({ isClosed: true });
      return;
    }
    const start = timeToMinutes(startDraft) ?? 9 * 60;
    const end = timeToMinutes(endDraft) ?? 17 * 60;
    mutation.mutate({ isClosed: false, overrideStartMinute: start, overrideEndMinute: end });
  }

  function commitOverrideHours() {
    if (exception.isClosed) {
      return;
    }
    const start = timeToMinutes(startDraft);
    const end = timeToMinutes(endDraft);
    if (start === null || end === null) {
      return;
    }
    if (start === exception.overrideStartMinute && end === exception.overrideEndMinute) {
      return;
    }
    mutation.mutate({ isClosed: false, overrideStartMinute: start, overrideEndMinute: end });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
      <span className="font-medium text-slate-800">{exception.date}</span>
      <span className="flex items-center gap-2">
        <Badge variant={exception.isClosed ? "secondary" : "outline"}>
          {exception.isClosed ? t("closedLabel") : t("overriddenLabel")}
        </Badge>
        {!exception.isClosed && (
          <>
            <Input
              type="time"
              className="w-28"
              value={startDraft}
              aria-label={t("overrideStartLabel")}
              onChange={(event) => setStartDraft(event.target.value)}
              onBlur={commitOverrideHours}
            />
            <Input
              type="time"
              className="w-28"
              value={endDraft}
              aria-label={t("overrideEndLabel")}
              onChange={(event) => setEndDraft(event.target.value)}
              onBlur={commitOverrideHours}
            />
          </>
        )}
        <Button type="button" variant="outline" size="sm" disabled={mutation.isPending} onClick={toggleClosed}>
          {exception.isClosed ? t("markOverriddenButton") : t("markClosedButton")}
        </Button>
      </span>
      {mutation.isError && (
        <span className="w-full text-xs text-red-600">
          {mutation.error instanceof ApiError && mutation.error.status === 403
            ? t("actionForbidden")
            : t("actionFailed")}
        </span>
      )}
    </li>
  );
}

function AddExceptionForm() {
  const t = useTranslations("businessHours");
  const [date, setDate] = useState("");
  const [isClosed, setIsClosed] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateBusinessHoursExceptionMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        date,
        isClosed,
        ...(isClosed
          ? {}
          : {
              overrideStartMinute: timeToMinutes(startTime) ?? 9 * 60,
              overrideEndMinute: timeToMinutes(endTime) ?? 17 * 60,
            }),
      });
      setDate("");
      setIsClosed(true);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("exceptionAddFailed"));
    }
  }

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("dateLabel")}
        <Input
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-40"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-600">
        <input type="checkbox" checked={isClosed} onChange={(event) => setIsClosed(event.target.checked)} />
        {t("closedLabel")}
      </label>
      {!isClosed && (
        <>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {t("overrideStartLabel")}
            <Input
              type="time"
              className="w-28"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {t("overrideEndLabel")}
            <Input type="time" className="w-28" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>
        </>
      )}
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? t("exceptionAddSubmitting") : t("exceptionAddSubmit")}
      </Button>
      {error && (
        <Alert variant="destructive" className="w-full">
          {error}
        </Alert>
      )}
    </form>
  );
}

function ExceptionsSection({ calendar }: { calendar: BusinessHoursCalendar }) {
  const t = useTranslations("businessHours");
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("exceptionsHeading")}</h2>
      {calendar.exceptions.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">{t("exceptionsEmpty")}</p>
      )}
      {calendar.exceptions.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {calendar.exceptions.map((exception) => (
            <ExceptionRow key={exception.id} exception={exception} />
          ))}
        </ul>
      )}
      <AddExceptionForm />
    </div>
  );
}

/**
 * Story 33 — Business Hours Calendar Management, over the already-existing
 * `BusinessHoursCalendarsController` (Story 12, never before consumed by
 * any frontend). A real 404 from `GET /business-hours-calendars` is a
 * valid "no calendar yet" state — distinguished from a generic failure the
 * same way `CustomerDetailView`/`TicketDetailView` already distinguish a
 * 404 from other errors — and routed to a create form instead of an error
 * banner.
 */
export function BusinessHoursView() {
  const t = useTranslations("businessHours");
  const calendarQuery = useBusinessHoursCalendarQuery();

  if (calendarQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const notFound = calendarQuery.isError && calendarQuery.error instanceof ApiError && calendarQuery.error.status === 404;

  if (calendarQuery.isError && !notFound) {
    return <Alert variant="destructive">{t("loadError")}</Alert>;
  }

  const calendar = calendarQuery.data;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
      {!calendar ? (
        <CreateCalendarForm />
      ) : (
        <>
          <WeeklyScheduleEditor calendar={calendar} />
          <ExceptionsSection calendar={calendar} />
        </>
      )}
    </section>
  );
}
