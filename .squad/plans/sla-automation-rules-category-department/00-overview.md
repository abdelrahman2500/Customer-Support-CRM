# sla-automation-rules-category-department — plan overview

Entry point for the **sla-automation-rules-category-department** feature.
Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 83 | [83-story-automation-rules-category-department.md](./83-story-automation-rules-category-department.md) | Automation Rules — Category & Department Actions | — | `sla-automation-rules` Story 57 (`AutomationRule` foundation), `ticket-recategorization-sla-target-recomputation` Story 16 (`ticket.recategorized` → `SlaTargetListener` reconciliation, reused verbatim) |

## Dependency notes

- Closes Story 57's own disclosed blocker (`sla-automation-rules/
  00-overview.md`, Design decision 1): an automation action that sets
  `category`/`departmentId` could desync `SlaTicketTarget` because
  nothing reacted to an automation-driven field change the way it
  reacts to a human `PATCH /tickets/:id`. That reconciliation mechanism
  (`TICKET_RECATEGORIZED_EVENT` → `SlaTargetListener.onTicketRecategorized`,
  Story 16) already exists and already re-derives the ticket's SLA target
  from whatever its current `category`/`priority`/`departmentId` are —
  `AutomationActionListener` (Story 57) just never emitted it, because it
  only ever touched `assignedToUserId`. This story is additive reuse of
  existing machinery, not a new reconciliation mechanism.
- `priority` is deliberately excluded and left for a separate, future
  story: `Ticket.priority` is `@default(MEDIUM)` and non-nullable, so
  there is no way to tell "the creator explicitly chose MEDIUM" from "no
  priority was given and the default applied" — the existing
  never-override-an-explicit-choice guard (Design decision 5) cannot be
  implemented correctly for `priority` without a separate schema
  decision (making it nullable, a larger migration touching every
  existing `priority` consumer). Not guessed here.
- No dependency on the unresolved external-provider decision — entirely
  internal to Ticketing/SLA & Automation, using only in-process domain
  events already in the codebase.
