# reporting-analytics-foundation — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 56  | [56-story-reporting-analytics-foundation.md](./56-story-reporting-analytics-foundation.md) | Reporting & Analytics Foundation | — | `ticketing` Story 07 (`Ticket`), `sla-policy-foundation`/`sla-breach-escalation` (`SlaTicketTarget`/`SlaEscalation`), `customer-portal-ticket-csat-feedback` Story 55 (`TicketCsatResponse`) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) after Story 55, which closed the Customer Portal domain entirely (submit ticket, track + history, Knowledge Base browsing, CSAT/feedback — all four capabilities `docs/architecture/08-supporting-domains.md` names). Reporting & Analytics is the next named-but-unstarted domain in `docs/architecture/03-domain-boundaries.md`'s domain table.
- Story 55's own plan overview already flagged this: "Reporting's own future, separate story" owns aggregating the CSAT data Story 55 captures — this story is that follow-up, and CSAT data now exists to report on.
- Preferred over AI Services and the Integration Hub (Communication/Channels, ERP): both require an external-provider decision (`docs/architecture/12-risks-tradeoffs-and-scope.md`) that is not eligible for autonomous selection (`CLAUDE.md` §2). Reporting & Analytics has no such gap — every input (`Ticket`, `SlaTicketTarget`, `SlaEscalation`, `TicketCsatResponse`) already exists.
- Preferred over `AutomationRule` (also unstarted, also no external-provider gap): Reporting has a stronger, more direct dependency-correctness signal (Story 55 just produced data this domain exists to report on), and the architecture doc explicitly names starting with "direct queries" before materialized views — the smallest correct first increment for this domain needs no new schema/migration at all, only a new read-only module over already-modeled data. `AutomationRule` remains a strong candidate for a future Recon cycle.
- Scoped as a **foundation** slice, mirroring every other domain's own "-foundation" precedent (`sla-policy-foundation`, `knowledge-base-foundation`, `background-job-producer-foundation`): direct Prisma queries only (`groupBy`/`aggregate`/`count`), no new `reporting` Prisma schema, no materialized views, no `reports-refresh` worker job — those are deliberately deferred to a follow-up story once "query load or retention needs" (the architecture doc's own trigger) justify them.
