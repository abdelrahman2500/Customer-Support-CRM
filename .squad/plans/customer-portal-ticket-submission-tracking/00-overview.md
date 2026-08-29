# customer-portal-ticket-submission-tracking — plan overview

Entry point for the **customer-portal-ticket-submission-tracking** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 53  | [53-story-customer-portal-ticket-submission-tracking.md](./53-story-customer-portal-ticket-submission-tracking.md) | Customer Portal — Submit & Track Own Tickets | — | `customer-portal-authentication-foundation` Story 52 (Contact auth), `ticketing` Stories 07/08/21 (`Ticket`, `TicketsService`, `TicketHistoryEntry`) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) run immediately after Story 52 and the workflow-policy commits. Story 52 explicitly deferred "view/track own tickets" as the natural next increment on its own authentication foundation (see that story's plan, Story Goal). This is the highest-priority unblocked candidate: it needs no new external dependency, extends a domain (Customer Portal) that is otherwise just a login screen, and directly closes the next capability named in `docs/architecture/08-supporting-domains.md`'s Customer Portal section ("submit ticket, view and track own tickets, history").
- Communication/Channels and Integrations remain blocked on an undecided external provider (unchanged since the last Recon). Knowledge Base's own next increment (full-text/vector search) has no real consumer yet (neither Portal nor Agent Workspace expose KB browsing) and was deprioritized in favor of this story, which has a concrete, already-built consumer (the authenticated portal session from Story 52).
- Scoped narrowly to "submit ticket, view own tickets, view history" only — Knowledge Base browsing and CSAT/feedback (also named in the same architecture line) are explicitly deferred to their own future stories; neither has a dependency this story needs to satisfy.
- Portal ticket visibility is scoped by **Customer**, not by individual Contact — `docs/architecture/08-supporting-domains.md` states "every portal query adds `customerId = currentCustomer.id`", i.e. every contact belonging to a Customer can see that Customer's tickets, not only the ones they personally opened. This is direct repository evidence, not an inferred guess.
- A portal-submitted ticket has no acting agent `User` — `TicketCreatedEvent.actorUserId` is `null` for it (mirrors `TicketEscalatedEvent`'s existing "no human actor" precedent), never the submitting Contact's id (which is not a valid `identity.users` foreign key and would silently break `TicketHistoryListener`'s insert if used).
