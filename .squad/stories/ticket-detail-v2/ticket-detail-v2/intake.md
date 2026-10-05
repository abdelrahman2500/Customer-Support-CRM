> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-detail-v2/ticket-detail-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket detail v2: inspector completion and polish
- **Feature slug (folder under `plans/`):** `ticket-detail-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-3.4**, global Story **219**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Ticket detail v2: inspector completion and polish
```

---

## Description

```
Story 219 — PR-3.4 of the CRM product redesign (roadmap Phase 3; merges
RD-3.10, RD-3.11 and the ticket-header half of RD-3.13).

GOAL
The ticket page wears the v2 language and its inspector is complete:
reference material and customer context read like sections of one
workspace, and changes made by colleagues are noticed.

CONTEXT
- The workspace (header, timeline, composer, inspector) was built in the
  previous track (Stories 201–209); KB references still sat in the main
  column and the customer panel used uppercase subheadings.
- Realtime joins the ticket room and invalidates the ticket on
  ticket.updated, so a refetch carries other people's changes.

REQUIRED OUTCOME
1. Status spine along the header's top edge (status hue).
2. KB references (RD-3.10): an inspector section; titles link to the
   article; unique names ("Remove {title}", "Attach {title}"); debounced
   search; per-row pending. Same requests.
3. Customer context (RD-3.11): identity (avatar, name, active/inactive/
   anonymized), the raising contact when known, other open tickets,
   primary contacts as a description list, a contextual link; no
   uppercase. Same two queries.
4. Header change cues (RD-3.13): status/priority/assignee changed by
   someone else pulse once and are announced politely; never the agent's
   own edits; reduced motion respected.
```

---

## Acceptance criteria

```
- [ ] KB references and customer context are inspector sections with the
      RD-3.10/3.11 behaviour; requests unchanged.
- [ ] Header spine in the status hue; cues only for others' changes.
- [ ] en/ar, light/dark, 390–1440 px without overflow.
- [ ] web tests, typecheck, lint, build and Playwright green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 201–209, 218 (cue vocabulary).
- **Depends on code areas or other stories:** `ticket-header.tsx`, `customer-context-panel.tsx`, `ticket-kb-references-card.tsx`.

## Extra notes (optional)

- Mobile/tablet layout, skeleton and prev/next are Story 220.

## Technical hints (optional)

- Own changes: the page's update mutation `variables` + `submittedAt`.

## Out of scope

- Lifetime CSAT/ticket KPIs (need the API), AI-suggested articles, collision detection.
