# customer-portal-ticket-csat-feedback — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 55  | [55-story-customer-portal-ticket-csat-feedback.md](./55-story-customer-portal-ticket-csat-feedback.md) | Customer Portal — Ticket CSAT / Feedback | — | `customer-portal-ticket-submission-tracking` Story 53, `ticketing` Story 50 (`TicketNote`, the direct child-entity precedent) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) after Story 54. `docs/architecture/08-supporting-domains.md` names four Customer Portal capabilities: submit ticket (Story 53), view/track own tickets + history (Story 53), Knowledge Base browsing (Story 54), and CSAT/feedback — this story closes the last one, completing the Customer Portal domain's entire documented scope.
- Preferred over AI Services (vendor already decided per `docs/architecture/07-sla-automation-and-ai.md`, but a larger, riskier lift needing a new external SDK dependency, a new `ai-processing` BullMQ queue, and a new schema) — CSAT needs none of that, mirrors the already-proven `TicketNote` (Story 50) child-entity shape almost exactly, and fully closes a domain rather than opening a new, larger one. AI Services remains a strong candidate for a future Recon cycle once this domain is closed.
- `docs/architecture/03-domain-boundaries.md`'s Reporting row ("ticket volume/aging, SLA, agent performance, and CSAT") implies CSAT *data* is captured elsewhere and later aggregated by Reporting — this story owns the capture (in the `ticketing` schema, as a Ticket child entity, mirroring `TicketNote`/`TicketHistoryEntry`), not the aggregation (Reporting's own future, separate story).
- Communication/Channels and Integrations remain blocked on an undecided external provider (unchanged).
