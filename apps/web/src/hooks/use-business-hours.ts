import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBusinessHoursCalendar,
  createBusinessHoursException,
  getBusinessHoursCalendar,
  updateBusinessHoursCalendar,
  updateBusinessHoursException,
} from "@/lib/business-hours-api";
import type {
  CreateBusinessHoursCalendarInput,
  CreateBusinessHoursExceptionInput,
  UpdateBusinessHoursCalendarInput,
  UpdateBusinessHoursExceptionInput,
} from "@/lib/business-hours-api";

/**
 * Story 33 — dedicated business-hours hooks (plan Design item 7), mirroring
 * `use-sla-policies.ts`'s "own file, no import from `use-tickets.ts`"
 * convention. Never applies any mutation optimistically — the same rule
 * every other mutation hook in this codebase follows.
 */
export const businessHoursCalendarQueryKey = ["business-hours-calendar"] as const;

export function useBusinessHoursCalendarQuery() {
  return useQuery({
    queryKey: businessHoursCalendarQueryKey,
    queryFn: getBusinessHoursCalendar,
  });
}

export function useCreateBusinessHoursCalendarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBusinessHoursCalendarInput) => createBusinessHoursCalendar(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessHoursCalendarQueryKey });
    },
  });
}

export function useUpdateBusinessHoursCalendarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBusinessHoursCalendarInput) => updateBusinessHoursCalendar(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessHoursCalendarQueryKey });
    },
  });
}

export function useCreateBusinessHoursExceptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBusinessHoursExceptionInput) => createBusinessHoursException(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessHoursCalendarQueryKey });
    },
  });
}

/** Bound to one existing exception's id, mirroring `useUpdateContactMutation`/
 * `useUpdateSlaPolicyMutation` — called once per `ExceptionRow` instance,
 * never inside a `.map()` (React's rules of hooks). */
export function useUpdateBusinessHoursExceptionMutation(exceptionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBusinessHoursExceptionInput) =>
      updateBusinessHoursException(exceptionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessHoursCalendarQueryKey });
    },
  });
}
