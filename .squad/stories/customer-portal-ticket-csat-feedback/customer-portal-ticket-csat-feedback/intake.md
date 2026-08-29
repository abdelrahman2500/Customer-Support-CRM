> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Customer Portal — Ticket CSAT / Feedback
- **Feature slug:** `customer-portal-ticket-csat-feedback`

## Description

```text
Recon after Story 54 found this as the last remaining named Customer Portal capability
("submit ticket, view and track own tickets, history, Knowledge Base browsing, and CSAT/feedback").
Closing it completes the entire domain's documented scope. Mirrors TicketNote's exact child-entity
shape, needs no new external dependency, and is smaller/lower-risk than AI Services (also considered,
deprioritized for a future cycle).
```

## Acceptance criteria

```text
- A portal Contact can submit a 1-5 rating + optional comment on their own Customer's ticket, once it
  is RESOLVED or CLOSED, exactly once.
- 400 if attempted on an OPEN/IN_PROGRESS ticket; 409 on a second attempt; 404 for a different
  customer's/unknown ticket.
- An agent can view (read-only) the submitted feedback via the existing ticket:read permission.
- Both frontends (portal submit/view, web read-only) show the correct state.
- English and Arabic translations exist for every new string in both apps.
- Backend unit and e2e tests, and frontend component tests, cover the new surface.
- No existing TicketsService/PortalTicketsService method is modified; only new, additive methods.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `ticketing` Story 50 (`TicketNote` precedent), `customer-portal-ticket-submission-tracking` Story 53.

## Out of scope

- CSAT aggregation/reporting, edit/delete of a response, survey reminders/notifications.
- Any README change.
