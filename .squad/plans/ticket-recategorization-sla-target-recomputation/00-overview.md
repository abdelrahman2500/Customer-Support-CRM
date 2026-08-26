# ticket-recategorization-sla-target-recomputation — plan overview

Entry point for the **ticket-recategorization-sla-target-recomputation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 16  | [16-story-ticket-recategorization-sla-target-recomputation.md](./16-story-ticket-recategorization-sla-target-recomputation.md) | Ticket Recategorization and SLA Target Recomputation | — | `ticketing` Stories 07–09, `sla-policy-foundation` Stories 10–13, `sla-timer-detection-foundation` Story 15 |

## Dependency notes

- New feature slug, deliberately not filed under `ticketing` or `sla-policy-foundation` alone — this story is the first to bridge them the other direction from Story 15 (Story 15 bridged `apps/api`↔`apps/worker` for SLA *detection*; this story bridges `Ticketing`'s update flow to `SLA & Automation`'s target computation, both inside `apps/api`). The closest precedent for "cross-cutting, spans two prior domain features, earns its own slug" is `sla-timer-detection-foundation` itself (Story 15's own overview).
- This story implements the two capabilities Story 15's intake explicitly deferred to it by name: `ticket.recategorized` and SLA target recomputation (`.squad/stories/sla-timer-detection-foundation/sla-timer-detection-foundation/intake.md`, "Extra notes"). It is the direct continuation of the SLA & Automation lifecycle described in `docs/architecture/07-sla-automation-and-ai.md` ("SLA targets are computed when a ticket is created or recategorized").
- Escalation reactions remain deferred to a future Story 17, per the same Story 15 intake note — not touched here.
- Does not modify `Ticketing`'s CASL/authorization model, the `SlaPolicy` resolution rule (Story 11), the `BusinessHoursCalendar` CRUD surface or schema (Story 12), the business-hours walk-forward algorithm itself (Story 13), or the `sla-timers` scheduler/detection worker (Story 15) — it is a producer of new/changed `SlaTicketTarget` rows those consume unchanged.
