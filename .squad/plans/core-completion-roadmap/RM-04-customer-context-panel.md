# RM-04 — Embedded Customer Context Panel

**Priority:** P1 · **Complexity:** Small-Medium · **Blocked:** No · **Phase:** 1 (Agent Experience)

## Goal

Surface a compact, real-data customer-context panel directly inside
`TicketDetailView`, so an agent never has to leave the ticket screen to see
the customer's other open tickets or primary contacts.

## Why it exists

`ticket-detail-view.tsx` today only links out to `/customers/[id]` (a plain
`Link`, no inline context). An agent working a ticket has no visibility
into whether the same customer has other open tickets, or who else is a
contact on the account, without navigating away and back. Both underlying
capabilities (customer's other tickets, customer's contacts) are already
fully built and API-complete — this is a pure frontend composition gap.

## Dependencies

None. Reuses existing, already-scoped endpoints: `GET /tickets?customerId=`
(`TicketsService.listTickets`) and `GET /customers/:id/contacts`
(`CustomersService.listContacts`).

## Backend work

None — no new endpoint. (If a combined "customer summary" read is judged
worth a single round-trip during implementation, a thin
`GET /customers/:id/summary` composing the two existing service calls is an
acceptable, optional micro-optimization — not required for correctness.)

## Frontend work

- A new `CustomerContextPanel` component, mounted in `TicketDetailView`
  alongside the existing cards, showing: the customer's other open tickets
  (excluding the current one, capped to a small count with a "view all"
  link to the full customer page) and primary contacts.
- Read-only — no editing capability from within this panel.

## Worker/realtime work

None.

## Schema/migration work

None.

## Tests

- `ticket-detail-view.spec.tsx` — extend for the new panel's
  loading/empty/populated states.

## Acceptance criteria

- Opening a ticket shows the customer's other open tickets and primary
  contacts inline, without navigating away.
- The panel respects existing branch/department scoping (it only ever calls
  already-scoped endpoints, so no new scoping logic is introduced or can be
  gotten wrong).

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
  pass. (No API changes expected — API test suites should be unaffected;
  confirm they still pass.)
- One dedicated commit, pushed.
