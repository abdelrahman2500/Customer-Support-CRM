import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContact,
  createCustomer,
  createTicket,
  createUser,
  getCustomer,
  getTicket,
  getTicketHistory,
  getTicketSlaTarget,
  listBranches,
  listCustomers,
  listDepartments,
  listTickets,
  listUsers,
  updateContact,
  updateCustomer,
  updateTicket,
  updateUser,
} from "@/lib/tickets-api";
import type {
  CreateContactInput,
  CreateCustomerInput,
  CreateTicketInput,
  CreateUserInput,
  ListTicketsFilters,
  UpdateContactInput,
  UpdateCustomerInput,
  UpdateTicketInput,
  UpdateUserInput,
} from "@/lib/tickets-api";

export const ticketsQueryKey = (filters: ListTicketsFilters) => ["tickets", filters] as const;
export const ticketQueryKey = (id: string) => ["ticket", id] as const;
export const ticketHistoryQueryKey = (id: string) => ["ticket", id, "history"] as const;
export const ticketSlaTargetQueryKey = (id: string) => ["ticket", id, "sla-target"] as const;

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

/** Long `staleTime`: a client-side name-resolution join over an
 * infrequently-changing list (Design item 9 of the plan) — not re-fetched
 * on every render. */
export function useCustomersQuery() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: listCustomers,
    staleTime: 5 * 60_000,
  });
}

/** Story 26 — mirrors `useTicketQuery`. `getCustomer` already returns
 * contacts embedded (Design item 1) — no second query needed for them. */
export function useCustomerQuery(id: string) {
  return useQuery({ queryKey: ["customer", id], queryFn: () => getCustomer(id) });
}

export function useUsersQuery() {
  return useQuery({ queryKey: ["users"], queryFn: listUsers, staleTime: 5 * 60_000 });
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

/** Invalidates every query a live `ticket.updated`/`ticket.escalated` event
 * for this ticket could have changed — used by `useTicketRealtime`. */
export function invalidateTicketQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ticketQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketHistoryQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketSlaTargetQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ["tickets"] });
}
