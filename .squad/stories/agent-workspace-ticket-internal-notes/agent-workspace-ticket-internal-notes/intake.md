> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-ticket-internal-notes/agent-workspace-ticket-internal-notes/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Ticket Internal Notes (Agent-Only)

- **Feature slug (folder under `plans/`):** `agent-workspace-ticket-internal-notes`

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
Agent Workspace — Ticket Internal Notes (Agent-Only)
```

---

## Description

```text
A Project Completion Audit performed after Story 49 found that Ticket Management, otherwise the most-built domain in the repository, is missing its single most conspicuous capability: an agent has no way to record a note on a ticket. A subsequent Next-Story Recon determined this should be Story 50 — narrowly scoped as agent-only internal notes, deliberately NOT designed as the seed of the future Communication/Channels domain.

Direct repository evidence resolved the scope boundary cleanly: `docs/architecture/03-domain-boundaries.md`'s domain table already assigns "inbound/outbound messages, threads" to the `channels` schema and "history/timeline" to `ticketing` — these are already two distinct, separately-owned concepts, not one merged idea waiting to be invented. `docs/architecture/06-communication-and-realtime.md`'s entire `ChannelMessage` vocabulary (channel type, external thread id, sender, provider) describes exclusively externally-sourced, customer-facing conversation and never contemplates an internal note. Building a plain, honestly-scoped `TicketNote` model — with no channel/source discriminator, never customer-visible — closes real product value now without preempting the Channels domain's own future, independent planning decision.

The new model mirrors the existing `TicketHistoryEntry` precedent almost exactly (ticket-scoped, `ticketing` schema, cascade-deleted, single `ticketId` index), with one deliberate, disclosed deviation: `authorUserId` is required, not nullable, since a note — unlike a history entry — can only ever result from a deliberate, authenticated agent action. Permission-wise, note creation reuses the existing `ticket:create` key (mirroring how `POST /customers/:id/contacts` already reuses `customer:create` rather than minting a new key), and reading notes reuses `ticket:read` (mirroring `GET /tickets/:id/history`). No new permission key, no new realtime room, no new gateway — the new `ticket.note-added` event is relayed through the already-existing `ticket:{id}` room by one new handler on the already-existing `TicketRealtimeListener`.
```

---

## Acceptance criteria

```text
- An agent holding `ticket:create` can add a free-text note to a ticket via `POST /tickets/:id/notes`.
- An agent holding `ticket:read` can list a ticket's notes via `GET /tickets/:id/notes`, ordered oldest-first; an empty list is returned (never a 404) for a ticket with no notes yet.
- No new permission key is introduced — both routes reuse the existing `ticket:create`/`ticket:read`.
- Notes are append-only — no edit or delete route exists for them anywhere.
- Notes are never customer-visible and carry no `channel`/`source`/`externalRef` field of any kind.
- A newly-added note reaches any other agent already viewing the same ticket in real time, via the existing `ticket:{id}` Socket.IO room — no new gateway, room, or socket-authentication mechanism is introduced.
- Cross-branch or nonexistent ticket ids are rejected with 404 for both routes, indistinguishable from a genuinely unknown id.
- Ticket Detail gains a new Notes card, placed after the existing History card, with correct loading/error/empty/populated states and a working inline add-note form (disabled until non-empty, clears on success, shows the backend's own message or a generic fallback on failure).
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and frontend component tests, cover the new endpoints/UI, including 401/403/404/400 cases, chronological ordering, and realtime-event emission.
- Exactly one Prisma migration is introduced (a new `TicketNote` table) — no existing table is altered.
- Every pre-existing test suite remains green, unweakened.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------- | --------------- |
| None                            | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `ticketing` Story 07/09 (`Ticket`, `TicketHistoryEntry`, `TicketsService`/`TicketsController`), `agent-workspace-customer-editing` Story 30 (`createContact`'s permission-reuse precedent), `realtime-socketio-foundation` Story 20 / `ticket-history-timeline-completion` Story 21 (`ticket:{id}` room, `TicketRealtimeListener`), `agent-workspace-sla-escalation-visibility` Story 49 (the most recent Ticket Detail card, the direct structural template).

- **Depends on code areas or other stories:** `apps/api/src/modules/tickets/**` (service, controller, DTO, events, one migration), `apps/api/src/realtime/ticket-realtime.listener.ts`. Touches `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, `apps/web/src/hooks/use-ticket-realtime.ts`, `apps/web/src/components/tickets/ticket-detail-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`. Does **not** touch `apps/api/prisma/seed.ts` (no new permission key), any identity/admin module, `sla-policies`, `notifications`, `customers`, `apps/portal`, or any Channels/KB/AI/Reporting code (none of which exists).

## Extra notes (optional)

- **No README changes** — consistent with every recent story's standing instruction.
- This story is explicitly NOT the seed of the future Communication/Channels domain — see the plan's Design item 3 for the full evidence trail. If Channels' eventual, independent planning pass later chooses to unify with or supersede this model, that is its own decision, not preempted here.
- One deliberate, disclosed deviation from the `TicketHistoryEntry` precedent it otherwise mirrors exactly: `TicketNote.authorUserId` is required, not nullable, since a note can only ever result from a deliberate, authenticated agent action (unlike a history entry, which can be system-generated).
- One deliberate, disclosed deviation in the realtime event shape: `TicketNoteAddedEvent` carries `{ ticketId, note }` rather than the other four ticket events' shared `{ ticket, actorUserId }` shape — inconsequential, since the frontend's realtime handler ignores payload contents entirely (blanket invalidation on any subscribed event).

## Technical hints (optional)

- Mirror `getTicketHistory`/`findTicketInScope` exactly for the new service methods — do not invent a new scoping mechanism.
- Mirror `createContact`'s exact permission-reuse and frontend call shape for the create side — this is the closest existing "create a child resource under a parent id" precedent anywhere in this codebase.
- Confirm the exact mechanism `createTicket`/`updateTicket` already use to resolve the authenticated actor's id for `TicketUpdatedEvent.actorUserId` at implementation time (not fully confirmed during planning) — reuse it for `createTicketNote`'s `authorUserId`, do not invent a new one.
- This is the first genuinely new Prisma model since Story 48 — unlike Stories 46-49, a real migration is required.

## Out of scope

- Customer-visible messages, customer replies, external conversations.
- Email, WhatsApp, SMS, live chat, web forms, the Integration Hub, `ChannelsModule`, `Channel`/`ChannelMessage`, external thread IDs, provider IDs, or any channel/source discriminator.
- Customer Portal messaging, AI-generated replies.
- Attachments on notes; editing or deleting a note.
- Ticket pagination/search; `Contact.isActive`; notification read/unread state; `createUser` foreign-key validation; the dead `agent:{id}:presence` realtime room.
- Knowledge Base, Reporting, Customer Portal, Integrations, the generic `AutomationRule` engine.
- Any README change.
