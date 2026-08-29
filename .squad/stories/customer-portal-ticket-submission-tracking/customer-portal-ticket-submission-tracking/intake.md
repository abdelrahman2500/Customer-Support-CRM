> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

- Folder: `.squad/stories/customer-portal-ticket-submission-tracking/customer-portal-ticket-submission-tracking/intake.md`

## Feature

- **Feature name (display):** Customer Portal — Submit & Track Own Tickets
- **Feature slug (folder under `plans/`):** `customer-portal-ticket-submission-tracking`

## Description

```text
Autonomous Recon after Story 52 (Customer Portal auth foundation) found the natural, already-flagged
next increment: Story 52 explicitly deferred "view/track own tickets" as its own non-goal. This closes
it, plus ticket submission — the two capabilities together are the smallest genuinely useful portal
surface (viewing with nothing to view, or submitting with no way to check on it, are each incomplete
alone). Portal ticket visibility is scoped by Customer (not individual Contact), per direct evidence in
docs/architecture/08-supporting-domains.md. Knowledge Base browsing and CSAT/feedback (named in the same
architecture line) are explicitly deferred to their own future stories.
```

## Acceptance criteria

```text
- An authenticated portal Contact can submit a new ticket (subject + optional category).
- An authenticated portal Contact can list every ticket belonging to their own Customer, newest first.
- An authenticated portal Contact can view one ticket's detail and its history.
- customerId/contactId/branchId are never accepted from the portal request body.
- A portal-submitted ticket's history entry has actorUserId: null, never the Contact's id.
- An agent-audience token is rejected (401) on every new portal-tickets route.
- A ticket belonging to a different Customer 404s, indistinguishable from a nonexistent id.
- English and Arabic translations exist for every new string in apps/portal.
- Backend unit and e2e tests, and frontend component tests, cover the new surface.
- No existing TicketsService method is modified; only new, additive methods are introduced.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `customer-portal-authentication-foundation` Story 52, `ticketing` Stories 07/08/21.
- **Depends on code areas:** `apps/api/src/modules/tickets/tickets.service.ts` (additive only), new `apps/api/src/modules/portal/portal-tickets.{controller,service}.ts` + dto, `apps/api/src/modules/portal/portal.module.ts`; new `apps/portal/src/lib/tickets-api.ts`, `apps/portal/src/hooks/use-portal-tickets.ts`, new portal route files, `apps/portal/src/components/providers/query-provider.tsx` (new), `apps/portal/src/app/[locale]/layout.tsx` (wrap in QueryProvider).

## Out of scope

- Knowledge Base browsing, CSAT/feedback in the portal.
- Ticket update/status/reassignment from the portal; realtime; pagination/search.
- Any README change.
