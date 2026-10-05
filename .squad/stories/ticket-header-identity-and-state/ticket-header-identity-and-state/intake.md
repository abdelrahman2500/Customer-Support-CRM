> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-header-identity-and-state/ticket-header-identity-and-state/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket header: identity and state
- **Feature slug (folder under `plans/`):** `ticket-header-identity-and-state`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.1**, global Story **201**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Ticket header: identity and state
```

---

## Description

```
Story 201 — RD-3.1 "Ticket header: identity and state" of the CRM UI/UX
redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md
Phase 3 shared constraints + "RD-3.1"; recon TW-01 (Critical), TW-09).

GOAL
A ticket header that identifies the ticket and shows its state at a glance:
back link, short id, subject (inline edit kept verbatim), status and
priority badges, SLA, assignee, customer link, created/updated times —
sticky at lg. Plus the Phase 3 section-survival guard spec.

CONTEXT (verified at HEAD c9d998d)
- apps/web/src/components/tickets/ticket-detail-view.tsx (969 lines):
  header block (~298–379) = BackLink, the subject h1 with an Edit button and
  an inline Input edit mode (Story 156: sr-only h1 while editing; Story 166:
  focus restore to the Edit trigger after Escape/Enter; blur commits via
  useUpdateTicketMutation, reverting on error), and "Customer: <link>".
  Status/priority/category/assignee/department are Selects in an untitled
  side Card (~485); SLA lives in its own side SectionCard with hold/resume.
  Nothing about state is visible at the top (TW-01).
- Available data: ticket {id, subject, status, priority, customerId,
  customerName, assignedToUserId, createdAt, updatedAt}; useUsersQuery
  (names) + useAgentPresence; useTicketSlaTargetQuery. **No channel field**
  exists on Ticket (schema or API) — the roadmap's "channel" item is
  deferred (no backend change).
- Primitives: TicketStatusBadge/TicketPriorityBadge (Story 191),
  SlaIndicator (192), Avatar/DescriptionItem/BackLink (189), formatDateTime
  (194). Labels exist: tickets.list.columns.{id,status,priority,sla,
  assignedAgent,customer,createdAt,updatedAt}, list.unassigned.
- Playwright agent-resolves-ticket uses getByLabel("Status") on the status
  Select — the header must not add any aria-label/label containing
  "Status"/"Priority" (strict mode); dt terms are not labels.
- Spec: ticket-detail-view.spec.tsx (1776 lines) — subject editing, focus
  restoration, Story 156 layout/section guards.

REQUIRED OUTCOME
1. New components/tickets/ticket-header.tsx owning the subject edit
   (moved verbatim: Escape cancels, Enter commits via blur, focus restore,
   revert on error) and a dl of facts: ID, Status, Priority, SLA,
   Assigned agent (Avatar + name, or Unassigned), Customer (link),
   Created, Updated.
2. TicketDetailView renders it in place of the old header block; sticky
   (lg:sticky lg:top-0) on the canvas background.
3. Section-survival guard: every section and every control of today
   asserted present (extends Story 156's guard).
```

---

## Acceptance criteria

```
- [ ] At 1280px status, priority, SLA and assignee are visible without
      scrolling (TW-01), and stay visible while scrolling (sticky at lg).
- [ ] The h1 is unchanged semantically (one h1 = subject, both modes).
- [ ] Subject edit behaviour identical (existing specs untouched and green).
- [ ] No new label containing "Status"/"Priority"; Playwright
      agent-resolves-ticket and agent-customer-live-chat green.
- [ ] Section-survival guard spec; header spec (en/ar labels, unassigned,
      SLA, times, no physical classes).
- [ ] 320/768/1280 × en/ar × light/dark: 0 overflow; keyboard/focus intact.
- [ ] No API/backend change; channel deferred.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.1 depends on Phase 2, RD-1.14, RD-1.15.
- **Depends on code areas or other stories:** Stories 189, 191, 192, 194, 197.

## Extra notes (optional)

- Header actions (Assign to me, Resolve) are RD-3.2; the inspector restructure is RD-3.3.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: new `ticket-header.tsx` (+spec), `ticket-detail-view.tsx` (+spec).

## Out of scope

- Actions (RD-3.2), inspector (RD-3.3), channel (no data), any backend change.
