> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/unified-timeline/unified-timeline/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Unified timeline
- **Feature slug (folder under `plans/`):** `unified-timeline`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.6**, global Story **206**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `packages/ui`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Unified timeline
```

---

## Description

```
Story 206 — RD-3.6 "Unified timeline" of the CRM UI/UX redesign track
(roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 3 "RD-3.6";
recon TW-04).

GOAL
An agent reads the whole story of a ticket in one place: customer messages,
replies, internal notes, history events and SLA escalations interleaved in
time order — with internal notes impossible to mistake for public replies,
and a filter to narrow the thread down.

CONTEXT (verified at HEAD d099c9f)
- ticket-chat-card.tsx (Story 205): SectionCard "detail.chatHeading"
  ("Conversation"); MessageThread (role=log, day groups) of MessageBubbles;
  ChatComposer below.
- ticket-detail-view.tsx: three more cards render the same ticket's
  chronology separately —
  * Notes (main column): notesQuery (useTicketNotesQuery), author via
    userNameById (raw authorUserId fallback), formatDateTime, body; then the
    AddNoteForm composer (RM-06 @mention).
  * SLA Escalations (inspector, collapsible): escalationsQuery;
    TARGET_TYPE_LABEL_KEYS label (raw targetType fallback); escalatedAt.
  * History (inspector): historyQuery; t(detail.historyEvent.<key>) via
    historyEventKey (Story 193); createdAt. actorUserId is never shown.
  Each has loading skeleton / inline error / empty message.
- Specs: ticket-detail-view.spec.tsx (Story 49 escalations, Story 50 notes,
  RM-06 mention, Story 156 layout, Phase 3 guard, Story 203 inspector) and
  ticket-chat-card.spec.tsx.
- Playwright agent-customer-live-chat counts the web log's <li> (expects
  exactly the two messages).
- No note edit/delete API is used (and none is added).

REQUIRED OUTCOME
1. The conversation card becomes the ticket timeline: messages, notes,
   history events and escalations, merged and sorted by time, in the
   existing MessageThread.
2. Internal notes: MessageBubble tone "note" (warning-subtle surface,
   warning border), a lock icon and an "Internal note" label.
3. Events (history, escalations): compact centred rows with an icon, the
   localized label, the actor (history: resolved from the users already
   loaded; omitted when unknown or system), and the time.
4. Filter: All / Conversation / Notes / Events (keyboard-operable tabs).
5. The Notes, History and SLA Escalations cards are removed; their loading,
   error and empty messages and their content carry over verbatim.
6. The note composer (AddNoteForm, @mention) stays, inside the timeline card
   below the reply composer (merging the two is RD-3.7).
```

---

## Acceptance criteria

```
- [ ] Every note, history event and escalation visible before is visible in
      the timeline (author/label/fallbacks unchanged), in time order (spec).
- [ ] Notes are never visually confusable with public replies: own tone,
      lock icon, "Internal note" text label (spec + screenshots).
- [ ] The filter is keyboard-operable (arrow keys; spec) and each filter
      shows only its kinds, with that kind's empty message.
- [ ] Notes composer and @mention unchanged (RM-06 specs green).
- [ ] Phase 3 guard updated with recorded reasons; Playwright live-chat
      green; web/ui tests, typecheck, lint, build; harness 320/768/1280 ×
      en/ar × light/dark with 0 overflow.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.6 depends on RD-3.5.
- **Depends on code areas or other stories:** Stories 49, 50, 193, 203, 205.

## Extra notes (optional)

- Note editing/deletion is out of scope (roadmap NG). The composer merge is RD-3.7.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/message-bubble.tsx` (+spec), `packages/ui/src/lib/icons.ts` (+spec, index), `apps/web/src/components/tickets/{ticket-chat-card,ticket-detail-view}.tsx` (+specs), `apps/web/messages/{en,ar}.json`, `apps/e2e/tests/agent-customer-live-chat.spec.ts`.

## Out of scope

- Note editing/deletion, the composer merge (RD-3.7), the portal, any backend change.
