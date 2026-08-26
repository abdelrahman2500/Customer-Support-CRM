> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/sla-policy-foundation/sla-target-computation/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** SLA & Automation

- **Feature slug (folder under `plans/`):** `sla-policy-foundation`

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

SLA Target Computation

---

## Description

Introduce SLA target computation for newly created tickets, as the second story in the `sla-policy-foundation` feature.

Story 10 established a real, branch-scoped `SlaPolicy` domain (schema, model, and permission-checked CRUD) but deliberately stored nothing on any ticket and reacted to no Ticketing event. This story is the first real consumer of `SlaPolicy`: it reacts to the existing `ticket.created` domain event (established by `ticketing` Stories 08–09) and, when a matching `SlaPolicy` exists for the new ticket's branch/department/category/priority, computes and persists a response/resolution target for that ticket.

This story follows the exact "first real subscriber" shape `ticketing` Story 09 used for `TicketHistoryListener`: a listener that reacts to an existing event, persists a new record, and catches and logs its own persistence failures so they can never break the original ticket-creation request.

A schema/domain recon for the new persistence model (`SlaTicketTarget`) has already been performed and is included below as a starting proposal — the planner must still verify it against the live repository and finalize exact field types, mappings, and migration shape during planning.

The following decisions have already been confirmed and must be treated as settled inputs to planning, not re-opened:

1. The new persistence model belongs to the `sla` Postgres schema — not `ticketing`. It is the SLA module's own derived data about a ticket, not Ticketing's, mirroring how `ticketing.TicketHistoryEntry` stayed inside `ticketing` because that data belonged to Ticketing itself.
2. The listener reacts to `ticket.created` only. It does **not** react to `ticket.updated`, and it does **not** introduce a new `ticket.recategorized` event — matching the same "smallest next increment" reasoning `ticketing` Story 09 used when it deferred `ticket.escalated`.
3. This story continues under the existing `sla-policy-foundation` feature slug rather than opening a new one — the same single-feature, multi-story arc `ticketing` used across Stories 07–09.
4. The exact **policy-resolution rule** (which `SlaPolicy` applies when more than one matches a ticket's branch/department/category/priority — `SlaPolicy` intentionally has no uniqueness constraint across those dimensions, per Story 10's own "Settled decisions") is **not** decided by this intake. It must be resolved during planning, from repository evidence and documented explicitly and deterministically in the plan. Do not invent a specific tie-break rule here.

---

## Acceptance criteria

- [ ] A listener subscribes to the existing `ticket.created` event only — not `ticket.updated`.
- [ ] The listener does not modify `TicketsService`, the existing event contract (`TicketCreatedEvent`/`TicketUpdatedEvent`), or any file under `apps/api/src/modules/tickets/**` beyond what is unavoidable to subscribe to the existing, unchanged event.
- [ ] When a matching, active `SlaPolicy` exists for the new ticket's branch (and, where scoped, department/category/priority), a target record is computed and persisted.
- [ ] When no matching `SlaPolicy` exists, no target record is created — this is a valid, non-error outcome, not a failure.
- [ ] The policy-resolution rule used when multiple `SlaPolicy` rows match is deterministic and explicitly documented in the plan.
- [ ] Computed targets are absolute timestamps derived from the ticket's creation time plus the matched policy's `responseTargetMinutes`/`resolutionTargetMinutes` — plain wall-clock arithmetic, no business-hours awareness (Story 10 explicitly deferred the business-hours calendar; this story does not introduce one).
- [ ] The new persistence model belongs to the `sla` Postgres schema, not `ticketing`.
- [ ] The new persistence model does not carry its own `branchId` — tenancy scope is derived through the parent `Ticket`, mirroring the existing `Contact`/`TicketHistoryEntry` precedent of not denormalizing branch onto a sub-record.
- [ ] Once computed, a target is not recomputed or mutated by this story (no `ticket.updated` reaction) — the record is effectively immutable once written.
- [ ] Listener persistence failures are caught and logged inside the listener and never propagate to break the original ticket-creation request, mirroring `TicketHistoryListener`'s existing pattern exactly.
- [ ] `EventEmitter2.emit()` remains synchronous; no `emitAsync`, no queue, no retry, no idempotency logic is introduced.
- [ ] No business-hours or holiday calendar model is introduced.
- [ ] No `sla-timers` job, no BullMQ, no scheduled/periodic processing is introduced.
- [ ] No `sla.at_risk`/`sla.breached` detection or emission is introduced.
- [ ] No escalation processing and no `AutomationRule` model is introduced.
- [ ] No `ticket.escalated` and no `ticket.recategorized` event is introduced.
- [ ] No Notifications, Socket.IO, or realtime functionality is introduced.
- [ ] No CASL and no new authentication/authorization mechanism is introduced — existing `AuthGuard`/`PermissionsGuard`/`TenantContext` conventions are reused unchanged wherever this story does need to check access (if any read surface is added at all — see Extra notes).
- [ ] No new permission key is introduced unless the plan identifies a concrete, justified need (e.g., only if a read endpoint is added) — do not invent one speculatively.
- [ ] `admin.audit_logs` and `AuditInterceptor` remain untouched.
- [ ] The migration (once generated during implementation) is purely additive.
- [ ] Unit tests cover the listener's policy-matching and persistence behavior, following the existing hand-built-mock pattern (`ticket-history.listener.spec.ts`).
- [ ] E2E coverage verifies at least: a ticket created with a matching policy produces a computed target; a ticket created with no matching policy produces none; existing regression suites continue to pass.
- [ ] `.squad/config.yaml` remains untouched.
- [ ] Existing regression tests (unit and e2e, across Identity & Access, Customer Management, Ticketing, and SLA Policy Foundation) continue to pass.

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------- | ---------- |
| None.                           |            |

---

## Dependencies

- **Blocked by / related ids:**
  - None.

- **Depends on code areas or other stories:**
  - `sla-policy-foundation` Story 10 — the real `SlaPolicy` model and `SlaPoliciesService` this story reads from.
  - `ticketing` Stories 07–09 — the real `ticket.created` event (`TicketCreatedEvent`, carrying `actorUserId` and the full `TicketSummary` snapshot) and the `TicketHistoryListener` catch-and-log pattern this story's own listener mirrors.
  - `project-foundation` Stories 01–05 — existing Prisma/seed/test conventions.

The required prerequisite stories are already complete.

---

## Extra notes (optional)

- Story 10 was the first story of this feature (`SlaPolicy` schema + CRUD only). This story is the second — a human-confirmed roadmap continuation following the "Next-Story Recon Report" performed after Story 10's completion, not a previously existing definition in the repository.
- A schema/domain recon for the new persistence model was performed separately and produced the following **starting proposal** (to be verified and finalized during planning, not treated as final):

  ```
  model SlaTicketTarget {
    id                 String    @id @default(uuid())
    ticketId           String    @unique @map("ticket_id")
    ticket             Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
    slaPolicyId        String    @map("sla_policy_id")
    slaPolicy          SlaPolicy @relation(fields: [slaPolicyId], references: [id])
    responseTargetAt   DateTime  @map("response_target_at")
    resolutionTargetAt DateTime  @map("resolution_target_at")
    createdAt          DateTime  @default(now()) @map("created_at")

    @@map("sla_ticket_targets")
    @@schema("sla")
  }
  ```

  Rationale already established: `ticketId` is `@unique` (a strict one-to-one with `Ticket`, not an append-only log, because this story never recomputes); `slaPolicyId` is kept for traceability; the two `*TargetAt` fields store already-resolved absolute timestamps (not raw minute counts) so a later edit to the policy never retroactively changes an already-computed ticket's target; no `updatedAt` (immutable once written); no `branchId` (scoped through the parent `Ticket`, per precedent).
- Whether a read endpoint (e.g., `GET /api/v1/tickets/:id/sla-target`) is added in this story, or deferred, is **not decided** — the planner should determine this from repository evidence (the same "does a foundation story need a paired read endpoint" reasoning already applied in Stories 06, 07, 09, and 10) rather than assume either way.
- Do not infer undocumented field names, listener names, module structure, or the specific policy-resolution algorithm from this intake. Those details must be resolved during planning from the repository's architecture documentation and existing implementation conventions (in particular `docs/architecture/07-sla-automation-and-ai.md` and the `TicketHistoryListener`/`SlaPoliciesService` precedents).

## Technical hints (optional)

- Repository root: `.`
- Primary language: `typescript`
- Existing backend: `apps/api`
- Existing Prisma schema: `apps/api/prisma/schema.prisma` — current `SlaPolicy` model at the end of the `sla` schema section; current `Ticket` model in the `ticketing` schema section.
- Existing event contract: `apps/api/src/modules/tickets/tickets.events.ts` (`TICKET_CREATED_EVENT`, `TicketCreatedEvent`).
- Existing "first real subscriber" precedent to mirror: `apps/api/src/modules/tickets/ticket-history.listener.ts` and its test `ticket-history.listener.spec.ts`.
- Existing SLA policy read access: `apps/api/src/modules/sla-policies/sla-policies.service.ts`.
- Existing tenancy mechanism: `TenantContext` (`apps/api/src/common/tenant/tenant-context.ts`).
- Existing testing patterns: hand-built-mock unit tests (see `ticket-history.listener.spec.ts`), real-`AppModule`/real-database e2e tests (see `tickets.e2e-spec.ts`, `sla-policies.e2e-spec.ts`).

Important: these are architectural/implementation hints only. The plan must inspect the repository's existing conventions before deciding exact field names, module/listener structure, the policy-resolution algorithm, and whether a read endpoint is included.

## Out of scope

- Business-hours calendar implementation.
- Holiday calendar implementation.
- SLA timers / scheduled/periodic SLA processing.
- BullMQ or any queue.
- SLA breach detection (`sla.breached`).
- SLA at-risk detection (`sla.at_risk`).
- Escalation processing.
- `AutomationRule` / automation engine.
- `ticket.escalated`.
- `ticket.recategorized` event creation.
- Changes to the existing `Ticket`/Ticketing event payload or contract.
- Recomputation of a target after a ticket is updated/recategorized.
- Notification delivery.
- Socket.IO or realtime functionality.
- Customer Portal.
- Communication / Channels.
- Knowledge Base.
- Reporting & Analytics.
- AI Services.
- Integrations.
- `Ticket.externalRef`.
- CASL.
- Changes to `.squad/config.yaml`.
- Changes to unrelated existing domains.
- Changes to `admin.audit_logs` or `AuditInterceptor`.
- Speculative generic abstractions.
