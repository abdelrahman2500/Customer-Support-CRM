> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/portal-tickets/portal-tickets/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Portal tickets
- **Feature slug (folder under `plans/`):** `portal-tickets`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-5.2**, global Story **230**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Portal tickets
```

---

## Description

```
Story 230 — PR-5.2 of the CRM product redesign (roadmap Phase 5).

GOAL
A customer's tickets look and behave like the rest of the product: the same
status spine, the same conversation, and clear next steps.

REQUIRED OUTCOME
1. My Tickets: a page header; ticket cards with the status spine (the whole
   card is the link); the create form beside the list on a wide screen and
   first on a phone, on FormField with a required marker; after creating,
   go straight to the new ticket when the response has its id.
2. Ticket detail: the header carries the status spine; feedback (CSAT)
   comes first once the ticket is resolved; a closed ticket says how to get
   more help; the conversation uses the shared MessageThread, MessageBubble
   and Composer; attachments upload through FileDropzone.
3. The portal's "Live Chat" heading becomes "Conversation", the agent's word.
4. customer-submits-ticket and the live-chat journey stay green.
```

---

## Acceptance criteria

```
- [ ] Spine cards, FormField create + navigate, detail layout, shared thread/composer/dropzone.
- [ ] Same API requests.
- [ ] en/ar, light/dark, 390/1280; portal tests, lint, build, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 205, 207, 208, 229.
- **Depends on code areas or other stories:** `apps/portal/src/components/tickets/**`.

## Extra notes (optional)

- The portal CSAT 204 case already maps to `null` (`getMyTicketCsat`); nothing to fix there.

## Technical hints (optional)

- `TicketCard` moves to `components/tickets/ticket-card.tsx`, shared with the home page.

## Out of scope

- Reopening closed tickets (no backend flow).
