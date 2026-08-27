> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

- **Folder:** `.squad/stories/sla-breach-escalation/sla-breach-escalation/intake.md`
- **Binaries (screenshots, PDFs, exports):** None.
- Do **not** rely on external links. The planner reads this file and files in `attachments/` only.

---

## Feature

- **Feature name (display):** SLA Breach Escalation
- **Feature slug:** `sla-breach-escalation`

## Tracker

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are not followed by the planner.

---

## Title

Story 17 — SLA Breach Escalation

---

## Description

Build the first real, narrow reaction to `sla.breached` (Story 15): when a target breaches, the SLA & Automation domain durably records that this specific breach was escalated, then `ticket.escalated` — the event `docs/architecture/03-domain-boundaries.md` names as one of Ticketing's own emitted events, alongside `ticket.created`/`ticket.updated` — fires, emitted from inside the `tickets` module, respecting Ticketing's ownership of it.

`ticket.escalated` means exactly: *the SLA system escalated this ticket because one of its SLA targets was breached.* It does **not** mean the ticket's priority, assignment, or department were changed — Story 17 makes no `Ticket` field changes of any kind.

**Trigger:** `SLA_BREACHED_EVENT` (`sla.breached`) only. `SLA_AT_RISK_EVENT` (`sla.at_risk`) is explicitly ignored by this story — at-risk stays a separate, not-yet-built, notification-oriented concern.

**Mechanism (verified against current code, not invented from scratch):**

Confirmed via direct inspection this session:
- `apps/api/src/modules/sla-policies/sla-detection.events.ts` — the *entire* current shape of `sla.breached`: `SlaBreachedEvent { ticketId: string; branchId: string; targetType: "response" | "resolution"; targetAt: Date }`, emitted via `EventEmitter2` by `apps/api/src/queues/sla-timer-events-bridge.processor.ts` (Story 15's worker-to-api bridge, unmodified, not touched by this story).
- `apps/api/src/modules/tickets/tickets.events.ts` — the exact, consistent pattern every `ticket.*` event follows: a constant + a `{ ticket: TicketSummary; actorUserId: string | null }` payload interface, emitted only from inside `apps/api/src/modules/tickets/tickets.service.ts`. No exception exists anywhere in the codebase to this "the owning module's own code calls `.emit()` for its own event" rule.
- `apps/api/src/modules/sla-policies/sla-target.listener.ts` (Stories 11/13/16) is the *only* existing precedent for one domain's listener needing ticket data — and it only ever **reads** `Ticket` via the shared Prisma client, never writes it, and never calls into `TicketsService`. There is **no existing precedent anywhere in this codebase** for one module calling another module's exported service method directly; every cross-module interaction observed (Story 08, 11, 15, 16) is `EventEmitter2`-mediated, independent-subscriber, matching `docs/architecture/02-system-architecture-overview.md`'s boundary rule 3 and the named top risk in `docs/architecture/12-risks-tradeoffs-and-scope.md:20` ("domain-event discipline erosion: direct cross-module calls can turn the modular monolith into a tangled system").

Given that unbroken precedent, this story does **not** have the SLA module call `TicketsService` directly, and does **not** have the SLA module import/emit `TICKET_ESCALATED_EVENT` itself (that would mean SLA code, not Ticketing code, is the thing calling `.emit()` for a Ticketing-owned event — breaking the one convention every existing event in this repo follows without exception). Instead, a second, small hop keeps ownership exactly where the architecture places it:

```
apps/worker (Story 15, unmodified)
  → SLA_TIMERS_QUEUE → SLA_TIMER_EVENTS_QUEUE
  → apps/api SlaTimerEventsBridgeProcessor (Story 15, unmodified)
    → EventEmitter2.emit(SLA_BREACHED_EVENT, {...})
      → NEW: SlaEscalationListener (sla-policies module)
          — persists one SlaEscalation row (idempotent, see below)
          — on successful persistence, EventEmitter2.emit(SLA_ESCALATED_EVENT, {...})
            → NEW: TicketEscalationListener (tickets module)
                — re-fetches the Ticket by event.ticketId (mirrors SlaTargetListener's own
                  re-fetch-by-id pattern, just in the opposite module direction)
                — EventEmitter2.emit(TICKET_ESCALATED_EVENT, { ticket, actorUserId: null })
```

`SLA_ESCALATED_EVENT` (`sla.escalated`) is a **new** SLA-owned event this story introduces (alongside `SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT` in `sla-detection.events.ts`) purely to hand off "this breach is now durably escalated" to Ticketing without SLA ever importing Ticketing's event types or reaching into `Ticket`. Its payload reuses `SlaDetectionEventBase` exactly (`ticketId`, `branchId`, `targetType`, `targetAt`) — no new fields invented.

This adds **zero new NestJS module dependency edges** (`TicketsModule` does not import `SlaPoliciesModule` or vice versa) — both new listeners only rely on the already-global `EventEmitter2` (`EventEmitterModule.forRoot()`, registered once in `app.module.ts`, unmodified), exactly like every existing cross-module listener in this codebase.

---

## Implementation contract (settled by this intake)

Answering each explicitly, per the review's requirement:

1. **Exact `sla.breached` payload available today:** `{ ticketId: string; branchId: string; targetType: "response" | "resolution"; targetAt: Date }` — verified directly from `apps/api/src/modules/sla-policies/sla-detection.events.ts`. Nothing else is available on this event; no additional fields are added to it by this story.
2. **Where the escalation reaction subscribes:** a new `@OnEvent(SLA_BREACHED_EVENT)` handler in a new listener class in the `sla-policies` module (the module that already owns every other `sla`-schema listener — `SlaTargetListener`).
3. **Persistent escalation data/model required:** yes — a new `SlaEscalation` Prisma model in the `sla` schema. Required because idempotency (item 5) must be enforced by a real database constraint, not an in-memory flag — the same principle Story 15 already established for its own fire-once guarantee ("The implementation must provide a real persistence-based idempotency guarantee. Do not rely on in-memory flags" — Story 15's own settled decisions).
4. **Unique identity for idempotency:** `(ticketId, targetType, targetAt)` as a composite unique constraint. Deliberately **not** `slaTicketTargetId` alone: Story 16's `SlaTargetListener.onTicketRecategorized` `upsert`s the *same* `SlaTicketTarget.id` on recategorization (the row's primary key never changes — only its `responseTargetAt`/`resolutionTargetAt`/`slaPolicyId` values do). `targetAt` is what genuinely changes between "breach under the pre-recategorization target" and "breach under the post-recategorization target," and it is already present on the event with zero extra lookups — this is the literal "identity of the specific breach transition" the review asked for, not a proxy for it.
5. **Same breach event delivered twice:** the listener attempts `prisma.slaEscalation.create(...)`; a second attempt hits the unique constraint (Prisma error code `P2002`), is caught, logged as "already escalated for this transition," and returns without emitting `sla.escalated` a second time. This is the concrete case Story 15's own edge cases already named as a known risk: *"The hand-back queue's job is processed by `apps/api`'s bridge processor more than once... `EventEmitter2.emit()` would fire twice for the same transition in that rare case"* — Story 17 is what actually closes that gap for the escalation path.
6. **Ticket already escalated for that specific breach:** identical handling to item 5 — the unique constraint covers both "true duplicate delivery" and "already escalated, redundant retry" with the same single code path; no separate branch is needed.
7. **How `ticket.escalated` respects Ticketing ownership:** via the two-hop chain in Description — the only code that ever calls `.emit(TICKET_ESCALATED_EVENT, ...)` lives inside the `tickets` module, exactly matching how every other `ticket.*` event in this codebase is emitted only from within that module.
8. **What SLA may read from Ticketing, and how:** nothing. The new SLA-side listener reads only its own `sla`-schema data (in fact, it needs no `Ticket`/`SlaTicketTarget` read at all — see item 9) — the first `sla`-schema listener in this codebase with zero Ticket dependency. The Ticketing-side listener reads `Ticket` directly via the shared Prisma client, exactly like `SlaTargetListener` already does today (an established, existing pattern — not a new one), and it reads **only its own module's table**.
9. **What the escalation record references:** `ticketId` (string, with a real `@relation` FK to `Ticket`, mirroring `SlaTicketTarget.ticketId`'s existing exact precedent — `apps/api/prisma/schema.prisma:361-362`), `branchId` (string, carried straight from the event payload — not re-derived), `targetType` (`"response" | "resolution"`), `targetAt` (the exact breached deadline), `escalatedAt` (`@default(now())`, when this row was created). Deliberately **no** `slaTicketTargetId`/`slaPolicyId` FK: resolving one would require an extra `SlaTicketTarget` lookup by `ticketId`, which can race against Story 16's `onTicketRecategorized` deleting that exact row (when a recategorization no longer matches any policy) between the breach detection and this reaction — a real, evidence-based race this design avoids entirely by not depending on `SlaTicketTarget` still existing at reaction time. If per-policy escalation reporting is ever needed, it is reachable later by joining on `(ticketId, targetType)` against `SlaTicketTarget`/history at query time, not by a FK stored now.
10. **Ticketing-side `ticket.escalated` emission fails after persistence:** `SlaEscalation` is already durably committed before `sla.escalated` is emitted, so "escalated" as a fact is never lost. If the Ticketing-side listener throws (e.g., the ticket can no longer be found), it catches and logs, matching every existing listener's convention — `ticket.escalated` simply does not fire for that instance. `EventEmitter2` gives no automatic redelivery for in-process emits (unlike BullMQ), so this is an accepted, documented gap, not a retried operation — the same "favor a documented rare-failure gap over new cross-cutting delivery machinery" precedent Story 15 already established for its own hand-back queue.
11. **Persistence itself fails** (the `SlaEscalation.create` call errors for a reason other than the unique constraint): caught and logged in the SLA-side listener; no `SlaEscalation` row exists, so nothing was recorded and nothing is emitted — the ticket remains correctly eligible for escalation on the next delivery of that same (or a later) breach, since no partial/incorrect state was left behind.
12. **Are retries safe:** yes — enforced by the real database unique constraint, not an application-level "already processed" flag. Redelivering the same `(ticketId, targetType, targetAt)` transition, however many times, converges to exactly one `SlaEscalation` row and at most one `sla.escalated`/`ticket.escalated` pair.
13. **Append-only or mutable:** append-only history, one row per distinct escalated breach transition — never updated after creation. This mirrors `TicketHistoryEntry`'s own established append-only convention (`apps/api/src/modules/tickets/ticket-history.listener.ts`) rather than inventing a new persistence shape.
14. **Repeated escalation after Story 16 recategorization:** represented as a second, independent `SlaEscalation` row for the same `ticketId`/`targetType` once `targetAt` genuinely differs (Story 16's recomputation is what produces that different value) — the composite unique key naturally allows exactly this and nothing more.
15. **Is `sla.at_risk` ignored:** yes, explicitly and only — the new SLA-side listener subscribes to `SLA_BREACHED_EVENT` alone; no code path in this story reacts to `SLA_AT_RISK_EVENT`.
16. **Priority/assignment/department mutation:** explicitly out of scope — confirmed no `Ticket` field is written anywhere in this design; the Ticketing-side listener only *reads* the ticket to build a `TicketSummary` for the event payload.
17. **`AutomationRule`:** explicitly out of scope — no generic trigger/condition/action model, no admin configurability, no workflow evaluation. `docs/architecture/07-sla-automation-and-ai.md:10`'s "a full workflow engine is explicitly deferred" stays intact; this story hard-codes exactly one reaction to exactly one event, matching this repository's own established "narrow foundation before generality" pattern (Story 15 chose the same trade-off for its worker-to-api bridge over a generic event bus).
18. **HTTP/CASL/frontend:** none required or added. Fully internal, event-driven. No new controller, no new `@RequirePermissions`, no `apps/web`/`apps/portal` change.

---

## Acceptance criteria

- [ ] A `SLA_BREACHED_EVENT` (`sla.breached`) causes exactly one `SlaEscalation` row to be persisted (on the first delivery of a given `(ticketId, targetType, targetAt)`).
- [ ] `SLA_AT_RISK_EVENT` (`sla.at_risk`) never causes an `SlaEscalation` row or any escalation-related emission.
- [ ] A duplicate delivery of the identical breach transition (same `ticketId`+`targetType`+`targetAt`) produces no second `SlaEscalation` row and no second `sla.escalated`/`ticket.escalated` emission.
- [ ] A distinct breach transition for the same ticket/targetType but a different `targetAt` (i.e., after Story 16 recategorization recomputed the target) is treated as a new, independent escalation — not suppressed.
- [ ] On successful `SlaEscalation` persistence, `sla.escalated` is emitted exactly once, from inside the `sla-policies` module, carrying `ticketId`/`branchId`/`targetType`/`targetAt`.
- [ ] `ticket.escalated` is emitted exactly once per successful `sla.escalated` reaction, only from code living inside the `tickets` module, with payload `{ ticket: TicketSummary; actorUserId: null }`.
- [ ] No `Ticket.priority`, `Ticket.assignedToUserId`, `Ticket.departmentId`, or any other `Ticket` field is written anywhere in this story's code.
- [ ] No `AutomationRule` model, generic trigger/condition/action evaluation, or admin-configurable automation is introduced.
- [ ] No new HTTP endpoint, no new `@RequirePermissions` permission string, no frontend change.
- [ ] Persistence failures and downstream (Ticketing-side) emission failures are caught and logged — never rethrown, never turn an unrelated in-flight request into a failure, matching every existing listener's convention.
- [ ] `apps/worker/**`, Story 15's `sla-timers` scheduler/cadence/detection semantics, Story 16's recategorization/recomputation/reset behavior, and `business-hours-calculator.ts` are all byte-for-byte unchanged.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Existing SLA policy, SLA target, SLA timer detection, ticket recategorization, ticketing, customer, and identity tests continue to pass.
- [ ] Unit tests cover: idempotent create (first delivery succeeds), duplicate delivery (second attempt suppressed, no double emit), a second genuinely-distinct `targetAt` for the same ticket/targetType (not suppressed), `sla.at_risk` never triggering anything, the Ticketing-side listener's re-fetch-by-id and catch-and-log behavior, and persistence-failure catch-and-log on both listeners.
- [ ] Integration/e2e coverage exercises the real chain against real Postgres/Redis: a real breach reaching `SlaEscalation`, and (fire-and-forget, polled) `ticket.escalated` observably firing via a real `EventEmitter2` listener resolved from the compiled module, mirroring `tickets.e2e-spec.ts`'s existing pattern for asserting real `EventEmitter2` wiring.

---

## Attachments

| File (relative to this folder) | What it is     |
| ------------------------------ | -------------- |
| None                            | No attachments |

---

## Dependencies

- **Blocked by / related ids:** Story 15 — SLA Timer Detection Foundation (`sla.breached`, fire-once detection). Story 16 — Ticket Recategorization and SLA Target Recomputation (established that `targetAt` can legitimately change more than once per ticket; this story's idempotency key is built directly on that fact).
- **Depends on code areas:** `apps/api/src/modules/sla-policies/sla-detection.events.ts`, `apps/api/src/modules/sla-policies/sla-target.listener.ts` (precedent only, not modified), `apps/api/src/modules/tickets/tickets.events.ts`, `apps/api/src/modules/tickets/tickets.service.ts` (`toTicketSummary` — currently a private, unexported function; this story's Ticketing-side listener needs to build an equivalent `TicketSummary`, so exporting `toTicketSummary` — or an equivalent — is in scope for this story's planning to resolve), `apps/api/prisma/schema.prisma`.

---

## Extra notes

- This is the story Story 15's and Story 16's intakes both named: *"Story 17 remains responsible for escalation reactions."* Nothing about that framing is reopened here; this intake only settles what "escalation reactions" concretely means for its first slice.
- The architecture review (this session, prior turn) is the basis for every ownership/mechanism decision above — re-verified directly against the live repository in this same session, not taken on faith from that report.
- Repeat escalation across a ticket's lifetime is intentional and expected (per Story 16's interaction), not a bug to prevent with a "ticket escalated once, ever" flag.
- Do not extend `TicketHistoryListener` to also record `ticket.escalated` in this story — nothing in the acceptance criteria requires it, and adding it would be scope creep into a decision (which events belong in ticket history) this intake was not asked to settle. Leave it for a future story if wanted.
- Do not modify `SlaTimerEventsBridgeProcessor`, `apps/worker/**`, the `sla-timers`/`sla-timer-events` queues, or `business-hours-calculator.ts`.

---

## Technical hints

- Repositories/roots: `.`
- Primary language: `typescript`
- New Prisma model lives in the `sla` schema, alongside `SlaPolicy`/`SlaTicketTarget`/`BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException` (`apps/api/prisma/schema.prisma`, `sla` schema currently spans lines 320-450).
- Minimum necessary schema shape (planner finalizes exact naming/mapping to match existing `sla`-schema conventions, e.g. `snake_case` `@map`s and `@@map("sla_escalations")`):

  ```prisma
  model SlaEscalation {
    id          String   @id @default(uuid())
    ticketId    String   @map("ticket_id")
    ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
    branchId    String   @map("branch_id")
    targetType  String   @map("target_type") // "response" | "resolution"
    targetAt    DateTime @map("target_at")
    escalatedAt DateTime @default(now()) @map("escalated_at")

    @@unique([ticketId, targetType, targetAt])
    @@map("sla_escalations")
    @@schema("sla")
  }
  ```

  `Ticket` gains a corresponding back-relation field (e.g. `slaEscalations SlaEscalation[]`), mirroring how `SlaTicketTarget` already added `slaTarget SlaTicketTarget?` to `Ticket` in Story 11.
- New event constant lives in `apps/api/src/modules/sla-policies/sla-detection.events.ts`, alongside `SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT`, reusing `SlaDetectionEventBase`.
- New event constant `TICKET_ESCALATED_EVENT = "ticket.escalated"` lives in `apps/api/src/modules/tickets/tickets.events.ts`, matching `TicketCreatedEvent`/`TicketUpdatedEvent`/`TicketRecategorizedEvent`'s exact `{ ticket: TicketSummary; actorUserId: string | null }` shape.
- New SLA-side listener registered as a provider in `SlaPoliciesModule` (same pattern `SlaTargetListener` already uses).
- New Ticketing-side listener registered as a provider in `TicketsModule` (same pattern `TicketHistoryListener` already uses).
- `toTicketSummary` in `tickets.service.ts` is currently module-private; exporting it (or extracting it) is the smallest way for the new Ticketing-side listener to build a `TicketSummary` without duplicating field-mapping logic — planner decides the exact mechanism.
- Prisma error code `P2002` (unique constraint violation) is the mechanism for detecting "already escalated" — follow whatever `PrismaClientKnownRequestError` handling convention (if any) already exists elsewhere in this codebase; if none exists, this may be the first place it's needed.
- Test patterns to follow: `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts` (hand-built Prisma mock, catch-and-log tests) for the SLA-side listener; `apps/api/test/tickets.e2e-spec.ts`'s real-`EventEmitter2`-listener assertion pattern for e2e proof that `ticket.escalated` really fires.

---

## Out of scope

- `sla.at_risk` reactions of any kind.
- Any `Ticket` field mutation (priority, assignment, department, status, category).
- `AutomationRule`, generic trigger/condition/action evaluation, admin-configurable automation, a workflow engine.
- Notification delivery of any kind (`NotificationsModule` does not exist yet; notifications are a separate, sibling reaction to `sla.at_risk`/`sla.breached` per `docs/architecture/07-sla-automation-and-ai.md:9`, not this story's responsibility).
- New HTTP endpoints, new CASL/`@RequirePermissions` permissions, any `apps/web`/`apps/portal` change.
- Modifying `SlaTimerEventsBridgeProcessor`, `apps/worker/**`, the `sla-timers`/`sla-timer-events` queue definitions or cadence, or `business-hours-calculator.ts`.
- Modifying `SlaTargetListener`'s existing `onTicketCreated`/`onTicketRecategorized` behavior.
- Extending `TicketHistoryListener` to record `ticket.escalated`.
- Any change to `SlaPolicy`/`SlaTicketTarget`'s existing columns or the four Story 15 fire-once notification columns.
- Retries/redelivery guarantees beyond what the unique-constraint-based idempotency already provides (no outbox pattern, no dead-letter handling).

---

## Migration expectations

**A Prisma migration is required.** This story introduces one new table (`sla.sla_escalations`) and one new back-relation on the existing `Ticket` model — additive only: no existing column, constraint, index, or table is modified. This mirrors the exact shape of every prior additive `sla`-schema migration in this repository (e.g., the `add_sla_ticket_targets` migration from Story 11).

---

## Verification

The final implementation must verify at minimum:

1. `pnpm install` (if the migration or any new dependency requires it — none expected).
2. API typecheck/lint/build.
3. Workspace typecheck/lint/build.
4. API unit tests.
5. Redis and Postgres available.
6. API integration/e2e tests, including the new escalation flow, run at least twice to rule out flakiness from the fire-and-forget event chain.
7. Existing regression suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation, Background Job Producer Foundation, SLA Timer Detection Foundation, Ticket Recategorization) remains green.
8. `git status` and diff inspection confirm `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, and `.squad/config.yaml` are untouched.
9. If CI is checked with `gh`, report it as pending if `gh` is unavailable; never assume CI success.

## Done criteria

The story is complete only when a real `sla.breached` transition results in exactly one persisted `SlaEscalation` row and exactly one `ticket.escalated` emission (from inside the `tickets` module), duplicate/retried delivery of the same transition never produces a second row or a second emission, a genuinely new breach transition after Story 16 recategorization is correctly treated as a new escalation, and no `AutomationRule`, `Ticket` field mutation, notification delivery, HTTP surface, or CASL permission was introduced.

STOP after producing the intake. Wait for confirmation before planning or implementing.
