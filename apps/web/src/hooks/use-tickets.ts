import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthenticatedUser } from "@crm/shared";
import { apiFetch } from "@/lib/api";
import {
  createContact,
  createCustomer,
  createTicket,
  createTicketNote,
  createUser,
  getCustomer,
  getTicket,
  getTicketCsat,
  getTicketEscalations,
  getTicketHistory,
  getTicketNotes,
  getTicketSlaTarget,
  listBranches,
  listCustomers,
  listDepartments,
  listTickets,
  listUsers,
  resetPassword,
  revokeContactPortalAccess,
  setContactPortalPassword,
  updateContact,
  updateCustomer,
  updateTicket,
  updateUser,
  updateUserAssignment,
} from "@/lib/tickets-api";
import type {
  CreateContactInput,
  CreateCustomerInput,
  CreateTicketInput,
  CreateTicketNoteInput,
  CreateUserInput,
  ListCustomersFilters,
  ListTicketsFilters,
  ResetPasswordInput,
  SetContactPortalPasswordInput,
  UpdateContactInput,
  UpdateCustomerInput,
  UpdateTicketInput,
  UpdateUserAssignmentInput,
  UpdateUserInput,
} from "@/lib/tickets-api";

export const ticketsQueryKey = (filters: ListTicketsFilters) => ["tickets", filters] as const;
export const ticketQueryKey = (id: string) => ["ticket", id] as const;
export const ticketHistoryQueryKey = (id: string) => ["ticket", id, "history"] as const;
export const ticketSlaTargetQueryKey = (id: string) => ["ticket", id, "sla-target"] as const;
export const ticketEscalationsQueryKey = (id: string) => ["ticket", id, "escalations"] as const;
export const ticketNotesQueryKey = (id: string) => ["ticket", id, "notes"] as const;
export const ticketCsatQueryKey = (id: string) => ["ticket", id, "csat"] as const;

export function useTicketsQuery(filters: ListTicketsFilters) {
  return useQuery({
    queryKey: ticketsQueryKey(filters),
    queryFn: () => listTickets(filters),
  });
}

export function useTicketQuery(id: string) {
  return useQuery({ queryKey: ticketQueryKey(id), queryFn: () => getTicket(id) });
}

export function useTicketHistoryQuery(id: string) {
  return useQuery({ queryKey: ticketHistoryQueryKey(id), queryFn: () => getTicketHistory(id) });
}

export function useTicketSlaTargetQuery(id: string) {
  return useQuery({
    queryKey: ticketSlaTargetQueryKey(id),
    queryFn: () => getTicketSlaTarget(id),
  });
}

/** Story 49 — mirrors `useTicketHistoryQuery`: no `staleTime`, since this is
 * per-ticket event data (not infrequently-changing reference data). */
export function useTicketEscalationsQuery(id: string) {
  return useQuery({
    queryKey: ticketEscalationsQueryKey(id),
    queryFn: () => getTicketEscalations(id),
  });
}

/** Story 50 — mirrors `useTicketHistoryQuery`/`useTicketEscalationsQuery`:
 * no `staleTime`, since this is per-ticket event data. */
export function useTicketNotesQuery(id: string) {
  return useQuery({
    queryKey: ticketNotesQueryKey(id),
    queryFn: () => getTicketNotes(id),
  });
}

/** Story 55 — read-only, mirrors `useTicketNotesQuery`: no `staleTime`,
 * since this can change the moment a customer submits feedback. */
export function useTicketCsatQuery(id: string) {
  return useQuery({
    queryKey: ticketCsatQueryKey(id),
    queryFn: () => getTicketCsat(id),
  });
}

/** Long `staleTime`: a client-side name-resolution join over an
 * infrequently-changing list (Design item 9 of the plan) — not re-fetched
 * on every render.
 *
 * Story 101 — gains an optional `filters` param, included in the query
 * key (mirrors the reporting hooks' own Story 93 parameterized-query-key
 * pattern: `useTicketVolumeQuery(range)` etc., which changed its own
 * query keys the exact same way). Omitting it (every existing call site —
 * the ticket-creation picker, `TicketListView`'s own customer-name
 * lookup) reproduces the exact pre-Story-101 all-customers *request*;
 * only the cache key's shape changes (`["customers"]` → `["customers",
 * {}]`), which starts every caller with a fresh cache entry once, not a
 * behavioral change.
 */
export function useCustomersQuery(filters: ListCustomersFilters = {}) {
  return useQuery({
    queryKey: ["customers", filters],
    queryFn: () => listCustomers(filters),
    staleTime: 5 * 60_000,
  });
}

/** Story 26 — mirrors `useTicketQuery`. `getCustomer` already returns
 * contacts embedded (Design item 1) — no second query needed for them.
 *
 * Story 43 — `enabled: Boolean(id)` added so this hook is safe to call with
 * an empty id (e.g. `CreateTicketView`'s `customerId` state before any
 * customer is chosen) without firing a real, invalid `GET /customers/`
 * request. `CustomerDetailView` (the only other consumer) always passes a
 * truthy route-param id, so this is a no-op there — zero behavior change.
 */
export function useCustomerQuery(id: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
    enabled: Boolean(id),
  });
}

export function useUsersQuery() {
  return useQuery({ queryKey: ["users"], queryFn: listUsers, staleTime: 5 * 60_000 });
}

/** Story 78 — the signed-in agent's own id, needed by `TicketChatCard` to
 * tell "my own message" apart from a colleague's `OUTBOUND` one (unlike a
 * Portal contact, several different agents can send `OUTBOUND` messages on
 * the same ticket). Client-side counterpart of `fetchCurrentUser` in
 * `@/lib/auth-server` (server components can't be used inside a chat card
 * mounted deep in a `"use client"` tree) — same `GET /auth/me`, no new auth
 * mechanism. Long `staleTime`, mirrors `useUsersQuery`: "who am I" doesn't
 * change mid-session. */
export function useCurrentUserQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<AuthenticatedUser>("/auth/me"),
    staleTime: 5 * 60_000,
  });
}

/**
 * Never applies the mutation optimistically (plan rule: "the frontend never
 * assumes an action will succeed," Design item 5) — the query cache is only
 * invalidated (forcing a re-fetch of the real, authoritative state) after
 * the real `PATCH /tickets/:id` response resolves successfully. A rejected
 * mutation leaves the cache untouched; the caller renders `mutation.error`.
 */
export function useUpdateTicketMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTicketInput) => updateTicket(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ticketHistoryQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

/**
 * Story 25 — never applies optimistically, same as `useUpdateTicketMutation`:
 * only a successful `POST /customers` invalidates `["customers"]`, forcing
 * every consumer (this workspace's customer picker included) to re-fetch
 * the real, authoritative list.
 */
export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => createCustomer(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Story 25 — same convention: only a successful `POST /tickets` invalidates
 * `["tickets"]`; the caller navigates to the real new ticket's detail page
 * rather than constructing an optimistic ticket object. */
export function useCreateTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => createTicket(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

/**
 * Story 30 — never applies optimistically, same as `useUpdateTicketMutation`:
 * a successful `PATCH /customers/:id` invalidates both this one customer's
 * detail query and the branch-wide `["customers"]` list (which also shows
 * `displayName`/`isActive`), forcing both to re-fetch the real, authoritative
 * state.
 */
export function useUpdateCustomerMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCustomerInput) => updateCustomer(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer", id] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Story 30 — same never-optimistic convention: only a successful
 * `POST /customers/:id/contacts` invalidates that customer's detail query
 * (whose already-embedded `contacts` array is the only place a contact is
 * ever rendered). */
export function useCreateContactMutation(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) => createContact(customerId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    },
  });
}

/** Story 30 — same never-optimistic convention as `useCreateContactMutation`. */
export function useUpdateContactMutation(customerId: string, contactId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateContactInput) => updateContact(customerId, contactId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    },
  });
}

/**
 * Story 52 — never applies optimistically, same convention as every other
 * mutation here.
 *
 * Story 100 — `ContactSummary.hasPortalAccess` now reflects the password
 * state, so a successful set now invalidates `["customer", customerId]`
 * (previously there was nothing to invalidate — no field of `ContactSummary`
 * reflected the password at all).
 */
export function useSetContactPortalPasswordMutation(customerId: string, contactId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetContactPortalPasswordInput) =>
      setContactPortalPassword(customerId, contactId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    },
  });
}

/** Story 100 — the inverse of `useSetContactPortalPasswordMutation`; same
 * invalidation, since both change `ContactSummary.hasPortalAccess`. */
export function useRevokeContactPortalAccessMutation(customerId: string, contactId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeContactPortalAccess(customerId, contactId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    },
  });
}

/**
 * Story 32 — never applies optimistically, same convention as every other
 * mutation here: only a successful `PATCH /identity/users/:id` invalidates
 * `["users"]`, forcing the list (the only place a user is rendered) to
 * re-fetch the real, authoritative state.
 */
export function useUpdateUserMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => updateUser(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Story 47 — never applies optimistically, same convention as every other
 * mutation here: only a successful `PATCH /identity/users/:id/assignment`
 * invalidates `["users"]`, forcing the list (the only place a user's
 * role/department is rendered) to re-fetch the real, authoritative state.
 */
export function useUpdateUserAssignmentMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserAssignmentInput) => updateUserAssignment(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Story 48 — never applies optimistically, same convention as every other
 * mutation here: only a successful `PATCH /identity/users/:id/password`
 * invalidates `["users"]`, consistent with every other mutation hook, even
 * though no field in `UserSummary` reflects the password.
 */
export function useResetPasswordMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPassword(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/** Story 38 — read-only, mirrors `useUsersQuery`'s `staleTime` convention
 * for infrequently-changing reference data. Populates the create-user
 * form's branch/department pickers. */
export function useBranchesQuery() {
  return useQuery({ queryKey: ["branches"], queryFn: listBranches, staleTime: 5 * 60_000 });
}

export function useDepartmentsQuery() {
  return useQuery({ queryKey: ["departments"], queryFn: listDepartments, staleTime: 5 * 60_000 });
}

/**
 * Story 38 — never applies optimistically, same convention as every other
 * mutation here: only a successful `POST /identity/users` invalidates
 * `["users"]`, forcing the list (the only place a user is rendered) to
 * re-fetch the real, authoritative state.
 */
export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/** Story 50 — never applies optimistically, same convention as
 * `useCreateContactMutation`: only a successful `POST /tickets/:id/notes`
 * invalidates this ticket's notes query. */
export function useCreateTicketNoteMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketNoteInput) => createTicketNote(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketNotesQueryKey(id) });
    },
  });
}

/** Invalidates every query a live `ticket.updated`/`ticket.escalated`/
 * `ticket.note-added` event for this ticket could have changed — used by
 * `useTicketRealtime`. */
export function invalidateTicketQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ticketQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketHistoryQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketSlaTargetQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketEscalationsQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketNotesQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ["tickets"] });
}
