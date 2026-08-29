> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-sla-escalation-visibility/agent-workspace-sla-escalation-visibility/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — SLA Escalation Visibility

- **Feature slug (folder under `plans/`):** `agent-workspace-sla-escalation-visibility`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Agent Workspace — SLA Escalation Visibility
```

---

## Description

```text
A Next-Story repository investigation after Story 48 (User Profile Correction) found that the identity/admin arc (Stories 32, 45–48) is now genuinely complete — the same "fixed forever at creation" pattern Story 48 closed for User does not exist anywhere else in the codebase (Customer/Contact were built with full Create/Update field parity from the start).

The strongest remaining, genuinely unblocked gap is `SlaEscalation`: the model and its write path have existed since Story 17 (SLA breach escalation) — escalations are actively generated and persisted every time a ticket breaches its SLA target — but there is zero read exposure anywhere in the API, confirmed explicitly by Story 17's own e2e-spec doc comment stating "no HTTP endpoint exposes SlaEscalation rows, by design — this story adds none." This mirrors the exact shape of gap Stories 36 (notifications) and 37 (audit logs) already closed for other write-only-until-then models, using the same proven pattern.

This story adds a single new read endpoint (reusing the existing sla:read permission, no new permission key, no schema change) and surfaces it as a new card on the existing Ticket Detail screen, mirroring the existing SLA-target/History cards' exact conventions.
```

---

## Acceptance criteria

```text
- An agent/admin holding `sla:read` can call `GET /tickets/:id/sla-escalations` and receive every SlaEscalation row for that ticket, ordered newest-first, or an empty array if none exist.
- The endpoint 404s ("Ticket not found") for a ticket id that doesn't exist or belongs to a different branch — never leaking cross-branch existence.
- No new permission key is introduced — the existing `sla:read` is reused.
- No Prisma schema change or migration is introduced.
- Ticket Detail shows a new "SLA Escalations" card directly below the existing SLA target card, with correct loading/error/empty/populated states matching the History card's established conventions.
- Target-type values ("response"/"resolution") render as human-readable labels; an unrecognized value falls back to the raw string rather than crashing.
- The existing `invalidateTicketQueries` realtime-invalidation function is updated to include the new query key, so a live `ticket.escalated` event keeps the new card fresh.
- Backend unit and e2e tests, and frontend component tests, cover the new endpoint/UI, including 401/403/404/empty/populated cases; the e2e test produces a real escalation row via the same event-emission technique Story 17's own e2e suite already established.
- Existing SLA-target card and History card tests remain green, unmodified.
- English and Arabic translations exist for every new string.
- Typecheck, lint, and build remain clean workspace-wide.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------- | --------------- |
| None                            | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `sla-breach-escalation` Story 17 (`SlaEscalation` model, write path), `sla-timer-detection-foundation` Story 15 (`SlaTargetsController`/`SlaTargetsService`, the structural template), `ticket-history-timeline-completion` Story 21 (`useTicketHistoryQuery`/History card, the UI template), `agent-workspace-user-profile-correction` Story 48 (most recent prior story).

- **Depends on code areas or other stories:** `apps/api/src/modules/sla-policies/**` (new controller/service, module registration). No Prisma schema/migration change. Touches `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, `apps/web/src/components/tickets/ticket-detail-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`. Does **not** touch `sla-escalation.listener.ts`, `TicketHistoryEntry`, any identity/admin module, or any ticket-messaging/portal/channels code.

## Extra notes (optional)

- **No README changes** — consistent with every recent story's standing instruction.
- The "list, not singular" and "empty array, not 404" shape decisions were both resolved directly from schema/precedent evidence during planning, not assumed — see the story plan's Design decisions section.
- `sla:read` is reused rather than a new permission key being minted — resolved by comparing against the existing precedent of `sla:read` already covering multiple SLA-domain reads, versus `notification:read`/`audit:read`'s genuinely-new-domain justification.

## Technical hints (optional)

- Mirror `SlaTargetsController`/`SlaTargetsService` exactly for the new controller/service pair (same module, same `/tickets` mount, same scoping mechanism) — do not invent a new pattern.
- The e2e test should reuse `sla-breach-escalation.e2e-spec.ts`'s technique of emitting `SLA_BREACHED_EVENT` directly on the real `EventEmitter2` to produce a genuine, persisted `SlaEscalation` row — no fake timers, no direct Prisma seeding.
- The ticket-scoped read (type + fetch function + hook) belongs in `tickets-api.ts`/`use-tickets.ts`, not `sla-policies-api.ts`/`use-sla-policies.ts` — mirrors where `getTicketSlaTarget` already lives.

## Out of scope

- Any change to SLA breach detection or escalation-creation logic.
- Any change to `TicketHistoryEntry`.
- Any branch-wide/cross-ticket SLA escalation dashboard, reporting, or analytics.
- Ticket messaging/comments/conversations, Communication Channels, Customer Portal, AI features.
- Any identity/admin work (Stories 45–48).
- `createUser`'s known, separately-disclosed branch-scoping inconsistency.
- Any README change.
