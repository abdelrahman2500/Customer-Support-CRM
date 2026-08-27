# sla-at-risk-notification-reaction — plan overview

Entry point for the **sla-at-risk-notification-reaction** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 18  | [18-story-sla-at-risk-notification-reaction.md](./18-story-sla-at-risk-notification-reaction.md) | SLA At-Risk Notification Reaction | — | `sla-timer-detection-foundation` Story 15, `sla-breach-escalation` Story 17 |

## Dependency notes

- New feature slug and, for the first time in this codebase, a **new domain/module**: `Notifications` (`notifications` Postgres schema), named in `docs/architecture/03-domain-boundaries.md` but never implemented before this story. Unlike Story 17 (which correctly extended the existing `sla` schema, since architecture assigns "escalation and automation rules" to SLA & Automation), this story's concern — "Templates, delivery logs, per-user preferences... owns notification routing" — is architecturally a distinct domain, so it gets its own module/schema rather than being bolted onto `sla-policies`.
- Consumes `sla.at_risk` (Story 15, `apps/api/src/modules/sla-policies/sla-detection.events.ts`), which has had zero consumers since Story 15 shipped it — Story 17 explicitly excluded it from breach escalation and named it "a separate notification-oriented concern for a future story."
- Deliberately does **not** build actual notification delivery (recipient resolution, template rendering, channel adapters, the `notifications` BullMQ queue) — `docs/architecture/06-communication-and-realtime.md`'s full `NotificationService` design remains a future story's concern. This story only establishes the narrowest possible first reaction: durably recording that an at-risk transition occurred, mirroring the exact "narrow foundation before generality" trade-off Story 15 and Story 17 both already made.
- Does not modify `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, or any Story 17 escalation code.
