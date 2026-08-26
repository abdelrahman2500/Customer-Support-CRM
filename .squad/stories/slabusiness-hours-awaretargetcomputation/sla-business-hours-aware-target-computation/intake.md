> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads this file and the files in `attachments/`, nothing else.

- Folder: `.squad/stories/slabusiness-hours-awaretargetcomputation/sla-business-hours-aware-target-computation/intake.md`

- Binaries (screenshots, PDFs, exports): None.

- Do not rely on external links. The planner should use this intake and any files in `attachments/` only.

---

## Feature

- **Feature name (display):** SLA Policy Foundation
- **Feature slug (folder under `plans/`):** `sla-policy-foundation`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are not followed by the planner.

---

## Title

SLA Business-Hours-Aware Target Computation

---

## Description

Extend SLA target computation so that newly created tickets receive business-hours-aware response and resolution targets using the BusinessHoursCalendar foundation introduced in Story 12.

The existing SlaTargetListener currently calculates responseTargetAt and resolutionTargetAt using plain wall-clock arithmetic.

This story should make the listener consume the branch-scoped BusinessHoursCalendar, BusinessHoursDay, and BusinessHoursException data and calculate the target timestamps according to the branch's existing IANA timezone.

The existing SLA policy resolution behavior from Story 11 remains unchanged: the most-specific matching policy wins, with earliest createdAt as the tie-breaker.

This story is about consuming the already-existing business-hours calendar foundation. It must not redesign or extend the calendar CRUD model.

The exact business-hours walk-forward behavior and edge cases must be settled during planning based on the existing repository conventions and the smallest coherent implementation. Do not invent unrelated scheduling or recurrence infrastructure.

---

## Acceptance criteria

- `SlaTargetListener` uses the branch's `BusinessHoursCalendar` when calculating response and resolution targets for a newly created ticket.
- Target computation uses the existing `Branch.timezone` as the timezone basis.
- Weekly business-hours configuration from `BusinessHoursDay` is respected.
- Closed weekdays are not counted as business time.
- Business-hours exceptions from `BusinessHoursException` are respected.
- Closed exceptions prevent business time from being counted for that date.
- Open exceptions can override the normal business-hours window for that date.
- Target computation correctly handles targets that span multiple business windows/days.
- The existing SLA policy resolution rule from Story 11 is preserved: most-specific-match-wins, with earliest `createdAt` as the tie-breaker.
- Existing behavior is not regressed for calendars representing continuous business availability.
- Persisted `SlaTicketTarget.responseTargetAt` and `SlaTicketTarget.resolutionTargetAt` values represent the computed business-hours-aware deadlines.
- Unit tests cover business-hours target calculation, including timezone handling, closed days, exceptions, and targets spanning multiple business periods.
- E2E coverage verifies the complete flow from ticket creation through asynchronous SLA target creation and retrieval.
- Existing SLA policy, SLA target, ticketing, customer, and identity tests continue to pass.
- No changes are made to the ticketing module's source files.

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None.                          |            |

---

## Dependencies

- **Blocked by / related ids:** None.
- **Depends on code areas or other stories:**
  - Story 10 — SLA Policy Foundation.
  - Story 11 — SLA Target Computation.
  - Story 12 — SLA Business-Hours Calendar Foundation.
  - `BusinessHoursCalendar`, `BusinessHoursDay`, and `BusinessHoursException` already exist in the `sla` schema.
  - `Branch.timezone` already exists and is the timezone basis.
  - Existing `SlaTargetListener` and `SlaTicketTarget` implementation from Story 11.

---

## Extra notes

- This is Story 13 and continues the existing `sla-policy-foundation` feature's open-ended story range.
- Story 12 intentionally created the business-hours calendar as a foundation without a consumer. This story introduces that consumer.
- The listener currently reacts to `ticket.created`. That trigger remains the only trigger in this story.
- The target record remains immutable after creation. This story does not introduce target recomputation.
- The existing asynchronous/fire-and-forget listener behavior should remain unchanged unless planning identifies a concrete correctness issue.
- The implementation should avoid introducing a recurrence engine or unrelated scheduling infrastructure.
- The planner must distinguish repository facts from design decisions and should resolve only the minimum necessary algorithmic rules for this story.

---

## Technical hints

- Repositories/roots: `.`
- Primary language: `typescript`
- Existing SLA module: `apps/api/src/modules/sla-policies/`
- Existing listener: `apps/api/src/modules/sla-policies/sla-target.listener.ts`
- Existing SLA target model: `SlaTicketTarget`
- Business-hours models:
  - `BusinessHoursCalendar`
  - `BusinessHoursDay`
  - `BusinessHoursException`
- Existing branch timezone: `Branch.timezone`
- Existing SLA policy matching behavior must remain unchanged.
- Existing SLA target endpoint: `GET /api/v1/tickets/:id/sla-target`
- Tests should follow the existing unit/e2e patterns used by Stories 10–12.

---

## Out of scope

- `ticket.updated` handling.
- `ticket.recategorized` event creation or handling.
- SLA target recomputation after a ticket has already received targets.
- Any modification under `apps/api/src/modules/tickets/**`.
- Changes to the `BusinessHoursCalendar` CRUD/API surface created by Story 12.
- Changes to the calendar schema unless strictly required by an implementation correctness issue discovered during planning.
- `sla-timers`.
- BullMQ producer/queue infrastructure.
- `sla.at_risk`.
- `sla.breached`.
- Escalation processing.
- `AutomationRule`.
- Notifications.
- Communication/channels.
- Holiday/recurrence infrastructure beyond the existing `BusinessHoursException` model.
- Any unrelated SLA policy behavior or permission changes.
