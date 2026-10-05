> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-header-actions/ticket-header-actions/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket header actions
- **Feature slug (folder under `plans/`):** `ticket-header-actions`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.2**, global Story **202**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Ticket header actions
```

---

## Description

```
Story 202 — RD-3.2 "Ticket header actions" of the CRM UI/UX redesign track
(roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 3 "RD-3.2";
recon TW-01 "no primary actions (Resolve, Assign to me)", TW-08).

GOAL
The two things an agent most often does to a ticket — take it, and resolve
it (or reopen it) — available in the ticket header, through the very same
request, toast and error handling as the inspector fields.

CONTEXT (verified at HEAD ba40bb8)
- TicketHeader (Story 201) renders identity + state; no actions.
- ticket-detail-view.tsx: the status Select calls
  mutation.mutate({ status }, { onSuccess: toast detail.statusUpdateSuccess
  {status: label} }); the assignee Select calls
  mutation.mutate({ assignedToUserId }, { onSuccess: toast
  detail.assignedAgentUpdateSuccess {agent: name} }); both disabled while
  mutation.isPending; a rejected mutation renders the shared error Alert
  below the header (403 vs generic).
- Backend allows every status transition (ticket-status-transitions.ts).
- useCurrentUserQuery() (GET /auth/me) gives the agent's own id.
- Playwright agent-resolves-ticket drives the status Select via
  getByLabel("Status") — the actions must not add a label containing it.

REQUIRED OUTCOME
1. Extract updateStatus(value) / updateAssignee(id) in the view; the
   inspector Selects and the header actions both call them (identical
   payload + toast).
2. Header actions: "Assign to me" (hidden when already assigned to me or
   the current user is unknown); status quick action — Resolve while
   OPEN/IN_PROGRESS; Close + Reopen while RESOLVED; Reopen while CLOSED.
   Disabled while the mutation is pending; text accessible names.
3. Actions sit in the title row (end), wrapping below on narrow screens.
```

---

## Acceptance criteria

```
- [ ] Each action sends exactly the inspector field's request (spec asserts
      payloads + toast), disabled while pending, with an accessible name.
- [ ] No new label containing "Status"; Playwright agent-resolves-ticket green.
- [ ] Section-survival guard extended with the header actions.
- [ ] 320/768/1280 × en/ar × light/dark: 0 overflow, focus rings.
- [ ] No API change; no new statuses; prev/next is RD-3.14.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.2 depends on RD-3.1.
- **Depends on code areas or other stories:** Story 201 (TicketHeader).

## Extra notes (optional)

- Unassign is RD-3.4 (only if the PATCH accepts null).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `ticket-header.tsx` (+spec), `ticket-detail-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`.

## Out of scope

- Prev/next (RD-3.14), new statuses, unassign, any backend change.
