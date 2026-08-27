> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.
>
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/sla-at-risk-notification-reaction/sla-at-risk-notification-reaction/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** SLA At-Risk Notification Reaction

- **Feature slug (folder under `plans/`):** `sla-at-risk-notification-reaction`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** ``

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

SLA At-Risk Notification Reaction

---

## Description

When an SLA target enters the at-risk window, the existing `sla.at_risk` domain event emitted by the SLA timer detection foundation must trigger a notification-oriented reaction.

This story establishes the first concrete consumer of `sla.at_risk`. The reaction must remain within the SLA & Automation architecture and must not be confused with SLA breach escalation.

The existing `sla.at_risk` event is emitted by the SLA timer detection flow and contains the existing `SlaDetectionEventBase` payload:

- `ticketId`
- `branchId`
- `targetType`
- `targetAt`

The story should define and implement the minimum notification reaction needed for an at-risk SLA transition, while preserving the existing event-driven domain boundaries.

The reaction must not modify the `Ticket` record or its SLA target. It must not escalate the ticket, change priority, assignment, department, status, category, or any other Ticket field.

The implementation should be idempotent for the same at-risk transition so repeated delivery of the same `sla.at_risk` event does not create duplicate notification work or duplicate persisted notification records, if persistence is introduced by the planned design.

The planner should inspect the existing architecture and repository state to determine the appropriate notification boundary, event payload, persistence requirements, delivery mechanism, and testing strategy. In particular, the planner should verify whether a `NotificationsModule` or notification persistence model already exists before introducing one.

This story is intentionally a notification reaction, not a generic automation engine. Do not introduce `AutomationRule` or a generic trigger/condition/action framework unless the planner finds an already-existing implementation that must be reused.

---

## Acceptance criteria

- [ ] `sla.at_risk` is consumed by a dedicated notification-oriented reaction.
- [ ] The reaction uses the existing `SlaDetectionEventBase` payload unless a concrete repository requirement proves additional fields are necessary.
- [ ] Repeated delivery of the identical at-risk transition does not produce duplicate notification work or duplicate persisted notification records.
- [ ] The at-risk reaction does **not** subscribe to `sla.breached` as its trigger.
- [ ] The at-risk reaction does **not** emit or cause `ticket.escalated`.
- [ ] No `Ticket` fields are mutated by this story.
- [ ] No SLA target fields are mutated by this story.
- [ ] No `AutomationRule` model or generic workflow engine is introduced.
- [ ] No unrelated ticketing behavior is changed.
- [ ] Cross-domain communication follows the existing `EventEmitter2` domain-event convention and does not introduce direct NestJS module dependency cycles.
- [ ] The implementation follows the repository's existing listener error-handling and logging conventions.
- [ ] Unit tests cover successful `sla.at_risk` handling, duplicate/idempotent delivery, and failure handling.
- [ ] An integration/e2e test verifies that a real `sla.at_risk` event reaches the notification reaction and produces the expected result.
- [ ] Existing SLA timer detection behavior remains unchanged.
- [ ] Existing SLA breach escalation behavior from Story 17 remains unchanged.
- [ ] Existing ticketing behavior remains unchanged.
- [ ] Full relevant unit, typecheck, lint, build, and e2e/regression verification is performed.
- [ ] Protected areas from previous SLA stories remain untouched unless the generated plan proves a necessary architectural change.
- [ ] The planner must explicitly document what constitutes the idempotency key for an at-risk transition and why.

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None.                          |            |

---

## Dependencies

- **Blocked by / related ids:** Story 15 — SLA Timer Detection Foundation; Story 17 — SLA Breach Escalation.

- **Depends on code areas or other stories:**

  - Existing `sla.at_risk` event and `SlaDetectionEventBase`.
  - Existing SLA timer detection event bridge.
  - Existing SLA & Automation module structure.
  - Existing `EventEmitter2` infrastructure.
  - Story 17's SLA escalation reaction should remain independent.
  - Any existing or newly established notification domain/persistence boundary discovered by the planner.

## Extra notes (optional)

- Story 15 explicitly introduced `sla.at_risk` but left it without a consumer.
- Story 17 explicitly excluded `sla.at_risk` from breach escalation and identified it as a future notification-oriented concern.
- The repository currently has no predefined Story 18 plan; this intake intentionally establishes the candidate selected after the Story 17 recon.
- Do not infer that "notification" means email, SMS, push, in-app, or any particular provider. The planner should inspect the architecture and repository and choose the smallest architecture-consistent notification foundation/reaction required by this story.
- Do not add frontend work unless the existing architecture requires a minimal consumer for an already-supported notification channel.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Existing event: `sla.at_risk`.
- Existing payload: `SlaDetectionEventBase`.
- Existing event infrastructure: NestJS `EventEmitter2`.
- Existing SLA module: `apps/api/src/modules/sla-policies/`.
- Existing ticket module: `apps/api/src/modules/tickets/`.
- Existing queue/worker architecture: `apps/api/src/queues/` and `apps/worker/`.
- The planner should inspect `docs/architecture/06-communication-and-realtime.md`, `docs/architecture/07-sla-automation-and-ai.md`, and the current repository before selecting the notification implementation boundary.
- Follow the established catch-and-log listener pattern unless the repository provides a more appropriate notification-specific pattern.

## Out of scope

- `sla.breached` handling or breach escalation; Story 17 already owns that concern.
- `ticket.escalated` emission.
- Any mutation of `Ticket`, `SlaTicketTarget`, or SLA policy data.
- Changes to SLA timer detection or its scheduling cadence.
- Changes to `business-hours-calculator.ts`.
- Generic `AutomationRule` or trigger/condition/action workflow engine.
- Generic automation framework.
- Ticket priority, assignment, department, status, category, or other Ticket-field changes.
- New ticketing endpoints or ticket permissions.
- Customer Portal notification UI unless explicitly required by an already-existing notification architecture.
- External notification provider integration unless the planner establishes that it is already required and available as part of the existing architecture.
- Unrelated Channels, Knowledge Base, AI, Reporting, Administration, or Integrations work.
- Changes to `apps/worker/**` or `apps/api/src/queues/**` unless the planner can prove the notification reaction requires an existing queue boundary; any such change must be explicitly justified in the generated plan.
