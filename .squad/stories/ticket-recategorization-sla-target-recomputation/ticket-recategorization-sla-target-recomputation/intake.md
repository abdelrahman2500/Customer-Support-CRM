> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.
>
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

- **Folder:** `.squad/stories/ticket-recategorization-sla-target-recomputation/ticket-recategorization-sla-target-recomputation/intake.md`

- **Binaries (screenshots, PDFs, exports):** None.

- **Do not** rely on external links. The planner reads **this file and the files in `attachments/`**, nothing else.

- This is **not** an implementation prompt. It is the input to Squad Kit's plan-generation meta-prompt.

---

## Feature

- **Feature name (display):** Ticket Recategorization and SLA Target Recomputation
- **Feature slug:** `ticket-recategorization-sla-target-recomputation`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are not followed by the planner. Keep the id for naming and traceability only.

---

## Title

**Story 16 — Ticket Recategorization and SLA Target Recomputation**

---

## Description

Implement the ticket recategorization flow required to recompute SLA targets when the SLA-relevant classification of an existing ticket changes.

A ticket is considered recategorized when one or more SLA-policy matching fields change:

- `category`
- `priority`
- `departmentId`

The ticket update flow must detect these changes and emit a dedicated `ticket.recategorized` event.

The existing SLA policy resolution and business-hours-aware target computation must be reused to recompute the ticket's `responseTargetAt` and `resolutionTargetAt`.

The recomputation must use the ticket's current tenant/branch scope and preserve the existing most-specific-match-wins SLA policy resolution behavior.

Story 15 introduced fire-once notification timestamps on `SlaTicketTarget`. When SLA targets are recomputed, the lifecycle of those notification timestamps must be handled correctly so notification state belonging to the previous target cannot incorrectly suppress or represent notifications for the newly computed target.

The implementation must remain compatible with Story 15's SLA timer detection foundation.

Escalation reactions are explicitly deferred to Story 17 and must not be introduced here.

---

## Acceptance criteria

- [ ] An update that does not change `category`, `priority`, or `departmentId` does not emit `ticket.recategorized`.
- [ ] Changing `category` emits exactly one `ticket.recategorized` event.
- [ ] Changing `priority` emits exactly one `ticket.recategorized` event.
- [ ] Changing `departmentId` emits exactly one `ticket.recategorized` event.
- [ ] Changing multiple SLA-policy matching fields in one update emits exactly one `ticket.recategorized` event.
- [ ] The event contains sufficient information for SLA recomputation and does not trust a client-supplied `branchId`.
- [ ] The SLA target listener/handler reacts to `ticket.recategorized`.
- [ ] Existing most-specific-match-wins SLA policy resolution is reused.
- [ ] Existing business-hours-aware target computation is reused.
- [ ] `responseTargetAt` is recomputed when the applicable SLA target changes.
- [ ] `resolutionTargetAt` is recomputed when the applicable SLA target changes.
- [ ] If no applicable SLA policy exists after recategorization, no stale previous SLA target remains active.
- [ ] Story 15 notification timestamps are correctly reset or invalidated when the target deadline is recomputed, according to the final domain decision established during planning.
- [ ] Recomputing a target remains safe when the previous target had already reached at-risk or breached state.
- [ ] Repeated recategorization does not create duplicate SLA target records for the same ticket lifecycle.
- [ ] Unrelated ticket updates retain their existing behavior.
- [ ] Story 15 timer detection continues to work correctly with recomputed targets.
- [ ] Unit tests cover unchanged fields, category changes, priority changes, department changes, multiple-field changes, event payload, policy re-resolution, target recomputation, business-hours behavior, notification-state lifecycle, no-policy behavior, and previously at-risk/breached targets.
- [ ] Integration/e2e tests cover the complete flow: ticket update → `ticket.recategorized` → SLA target recomputation.
- [ ] Existing ticketing and SLA tests continue to pass.
- [ ] Typecheck, lint, build, unit tests, and relevant e2e tests pass.
- [ ] No escalation reaction, escalation job, or escalation workflow is introduced.

---

## Attachments

| File (relative to this folder) | What it is                      |
| ------------------------------ | ------------------------------- |
| None                           | No binary attachments required. |

---

## Dependencies

- **Blocked by / related ids:** None.

- **Depends on:**

  - Stories 07–09 — Ticketing foundation and ticket update/event infrastructure.
  - Story 10 — SLA policy model.
  - Story 11 — SLA target listener and `SlaTicketTarget`.
  - Stories 12–13 — Business-hours-aware SLA target computation.
  - Story 14 — Background job producer foundation.
  - Story 15 — SLA timer detection and notification-state persistence.
  - Existing `TenantContext` and authorization infrastructure.

---

## Extra notes

- Story 15 explicitly deferred `ticket.recategorized` and SLA target recomputation to Story 16.
- Story 15 explicitly deferred escalation reactions to Story 17.
- The planner must inspect the actual repository before deciding implementation details.
- The planning pass must explicitly resolve:

  1. Whether `ticket.recategorized` should be emitted as a dedicated event or derived from `ticket.updated`.
  2. Exactly which field changes qualify as recategorization.
  3. What happens to Story 15 notification timestamps when target deadlines are recomputed.
  4. How to handle a ticket that was already at-risk or breached under the previous target.
  5. Whether recomputation updates the existing `SlaTicketTarget` or requires another lifecycle mechanism.

- Do not invent a parallel SLA policy resolution or target calculation path.
- Preserve the architectural boundaries established by Stories 10–15.

---

## Technical hints

- **Repos/roots:** `.`
- **Primary language:** `typescript`
- **Persistence:** PostgreSQL + Prisma.

Relevant existing areas include:

- `apps/api/src/modules/tickets/**`
- `apps/api/src/modules/sla-policies/**`
- `apps/api/prisma/schema.prisma`
- Existing `ticket.updated` event infrastructure
- Existing `SlaTargetListener`
- Existing `SlaTicketTarget`
- Existing business-hours calculation utilities
- Story 15 SLA timer detection code

The planner should inspect the current implementation and settled architecture before proposing changes.

---

## Out of scope

- Escalation reactions or escalation jobs — Story 17.
- SLA at-risk/breach detection — Story 15.
- The `sla-timers` scheduler — Story 15.
- Changes to scheduler cadence.
- New notification channels.
- Customer portal SLA behavior.
- Ticket attachments/object storage.
- Interaction history.
- New SLA policy matching rules.
- Rewriting the existing business-hours calculation.
- Creating a second SLA target calculation mechanism.
- Unrelated ticket lifecycle changes.
