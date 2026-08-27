import { apiFetch } from "./api";

/**
 * Story 33 — Business Hours Calendar Management. A dedicated API client
 * file (plan Design item 7): business-hours calendars are a distinct domain
 * from tickets/customers/users/SLA-policies, with no existing precedent
 * forcing them into `tickets-api.ts`/`sla-policies-api.ts`, so this file
 * deliberately does not import from or re-export anything there.
 *
 * Mirrors `apps/api/src/modules/sla-policies/business-hours-calendars.service.ts`'s
 * own `BusinessHoursDaySummary`/`BusinessHoursExceptionSummary`/
 * `BusinessHoursCalendarSummary` exactly — confirmed against that file
 * during implementation. `weekday` follows `Date#getUTCDay()` (0=Sunday..
 * 6=Saturday); `startMinute`/`endMinute`/`overrideStartMinute`/
 * `overrideEndMinute` are all minutes-since-midnight.
 */
export interface BusinessHoursDay {
  weekday: number;
  isOpen: boolean;
  startMinute: number | null;
  endMinute: number | null;
}

export interface BusinessHoursException {
  id: string;
  date: string;
  isClosed: boolean;
  overrideStartMinute: number | null;
  overrideEndMinute: number | null;
}

export interface BusinessHoursCalendar {
  id: string;
  days: BusinessHoursDay[];
  exceptions: BusinessHoursException[];
}

/** Mirrors `CreateBusinessHoursCalendarDto`/`UpdateBusinessHoursCalendarDto` exactly. */
export interface BusinessHoursDayInput {
  weekday: number;
  isOpen: boolean;
  startMinute?: number;
  endMinute?: number;
}

export interface CreateBusinessHoursCalendarInput {
  days: BusinessHoursDayInput[];
}

export interface UpdateBusinessHoursCalendarInput {
  days?: BusinessHoursDayInput[];
}

/** Mirrors `CreateBusinessHoursExceptionDto` exactly (`date` is `YYYY-MM-DD`). */
export interface CreateBusinessHoursExceptionInput {
  date: string;
  isClosed?: boolean;
  overrideStartMinute?: number;
  overrideEndMinute?: number;
}

/** Mirrors `UpdateBusinessHoursExceptionDto` exactly. */
export interface UpdateBusinessHoursExceptionInput {
  isClosed?: boolean;
  overrideStartMinute?: number;
  overrideEndMinute?: number;
}

export function getBusinessHoursCalendar(): Promise<BusinessHoursCalendar> {
  return apiFetch<BusinessHoursCalendar>("/business-hours-calendars");
}

export function createBusinessHoursCalendar(
  input: CreateBusinessHoursCalendarInput,
): Promise<BusinessHoursCalendar> {
  return apiFetch<BusinessHoursCalendar>("/business-hours-calendars", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBusinessHoursCalendar(
  input: UpdateBusinessHoursCalendarInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/business-hours-calendars", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function createBusinessHoursException(
  input: CreateBusinessHoursExceptionInput,
): Promise<BusinessHoursException> {
  return apiFetch<BusinessHoursException>("/business-hours-calendars/exceptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBusinessHoursException(
  exceptionId: string,
  input: UpdateBusinessHoursExceptionInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/business-hours-calendars/exceptions/${exceptionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
