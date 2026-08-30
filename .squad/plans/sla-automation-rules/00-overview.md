# sla-automation-rules — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 57  | [57-story-sla-automation-rules.md](./57-story-sla-automation-rules.md) | SLA & Automation — Automation Rules Foundation | — | `ticketing` Story 07/08 (`TICKET_CREATED_EVENT`), `sla-policy-foundation` (the `sla` schema/module `AutomationRule` joins) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) after Story 56. `docs/architecture/07-sla-automation-and-ai.md`'s "SLA & automation" section names `AutomationRule` ("a simple trigger-condition-action row, evaluated against domain events... A full workflow engine is explicitly deferred") as still fully unimplemented — no `AutomationRule` model exists anywhere in the schema.
- Preferred over AI Services (the only other remaining domain with no unresolved external-provider decision — `docs/architecture/12-risks-tradeoffs-and-scope.md`'s trade-off table already settles the vendor as "Anthropic Claude behind `AiProvider`"): AI Services still needs a real API credential this environment does not have and cannot safely fabricate (a genuine, narrower blocker than an architectural ambiguity — `CLAUDE.md` §9.B), plus a new schema/queue/adapter layer. `AutomationRule` needs neither — it is dependency-correct, architecturally coherent with the already-proven cross-domain event-listener pattern (`SlaTargetListener`/`TicketEscalationListener`), and smaller.
- Communication/Channels and the Integration Hub remain blocked on an undecided external provider (unchanged).
- **v1 scope is deliberately narrow** to sidestep a real consistency risk found during Recon: `SlaPolicy` matches on `category`/`priority`/`departmentId` (the same three fields `TICKET_RECATEGORIZED_EVENT`'s own doc comment names as "the SLA-policy matching fields"), and `SlaTargetListener` computes/recomputes SLA targets only on `ticket.created`/`ticket.recategorized`. An automation action that changed any of those three fields post-creation could silently desync a ticket's SLA target from its actual classification, with no existing mechanism to reconcile the two. `assignedToUserId` participates in no SLA-policy matching dimension, so this story's only supported action (auto-assign to a specific agent) creates no such risk — a wider action set (auto-set category/priority/department) is deferred to a future story that also addresses this reconciliation, not attempted here.
