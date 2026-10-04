> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-presentation/ticket-presentation/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket status and priority presentation
- **Feature slug (folder under `plans/`):** `ticket-presentation`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-1.14**, global Story **191**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `packages/shared`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Ticket status and priority presentation
```

---

## Description

```
Story 191 — RD-1.14 "Ticket status and priority presentation" of the CRM
UI/UX redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md
§6 "RD-1.14", component table rows "Ticket status/priority presentation map"
and "TicketStatusBadge, TicketPriorityBadge"; decision D12 "ticket
presentation constants in @crm/shared: yes"; binding semantics:
docs/architecture/13-design-language.md "Status semantics").

GOAL
One source of truth for how a ticket status or priority looks — tone + icon
+ localized label — shared by both apps, so colour is never the only signal
and the two apps can't drift.

CONTEXT (verified at HEAD 23ff157)
- Design language (binding): status OPEN→info · IN_PROGRESS→progress ·
  RESOLVED→success · CLOSED→neutral; priority LOW/MEDIUM→neutral ·
  HIGH→warning · URGENT→danger. Statuses never use warning/danger;
  priorities never use info/progress. Status is always icon + label + tone.
- Today: apps/web/src/lib/ticket-badges.ts (ticketStatusBadgeVariant:
  OPEN→warning, IN_PROGRESS→secondary, RESOLVED→success, CLOSED→outline;
  ticketPriorityBadgeVariant: URGENT→destructive, HIGH→warning,
  LOW/MEDIUM→secondary) + spec; apps/portal/src/lib/ticket-badges.ts
  (status only) + spec. OPEN and HIGH are both amber; IN_PROGRESS, LOW and
  MEDIUM are all grey — the collisions the roadmap names. No icons.
- Call sites (web): ticket-list-view.tsx (status + priority cells),
  dashboard-view.tsx (two rows: status + priority), customer-detail-view.tsx,
  customer-context-panel.tsx (status + priority), tasks-panel.tsx (task
  priority — TaskPriority has the same members), sla-policy-list-view.tsx:191
  (priority, `outline`). Labels via hooks/use-ticket-labels.ts
  (`common.ticketStatus.*`, `common.ticketPriority.*`).
- Call sites (portal): portal-home-view.tsx, tickets/ticket-list-view.tsx,
  tickets/ticket-detail-view.tsx (status). Labels via `tickets.status.*`.
  The portal has no priority labels; its raw priority text on the detail
  page is RD-1.16's scope.
- Reports: reporting/report-charts.tsx `ticketStatusBarColor` mirrors the
  old badge map (OPEN warning-solid, RESOLVED success-solid, CLOSED
  rule-strong, IN_PROGRESS ink-subtle) + spec.
- @crm/shared is consumed from its built dist (turbo `^build` runs first in
  CI); until now the frontends import only types from it.
- Badge (Story 185) already has `info` and `progress` variants and an
  optional decorative `icon`.
- QA review QA-02 (independent review, MEDIUM, non-blocking): progress
  (violet) and accent (indigo) are close in hue; RD-1.14 must always render
  the status icon + label and include a screenshot of an IN_PROGRESS badge on
  a hovered/selected row and next to a primary button; if confusable, raise
  a design-direction change for approval (do not change tokens here).

REQUIRED OUTCOME
1. packages/shared/src/ticket-presentation.ts: pure data — the status and
   priority value lists, tone and icon key per value, tolerant lookups for
   unknown values (neutral). No React.
2. @crm/ui gains role-named icons for the four statuses and four priorities
   (icon module convention).
3. Web: TicketStatusBadge + TicketPriorityBadge (own i18n via
   useTicketLabels) replace every variant-helper call site, including the
   SLA-policy priority badge and the task priority badge. Portal:
   TicketStatusBadge replaces its three call sites.
4. report-charts `ticketStatusBarColor` derives from the shared map.
5. Both apps' ticket-badges.ts (+ specs) deleted.
6. QA-02 evidence: screenshots of IN_PROGRESS on a hovered row and next to a
   primary button, light + dark; record the judgement in progress.md.
```

---

## Acceptance criteria

```
- [ ] No visual collision: OPEN ≠ HIGH and IN_PROGRESS ≠ LOW/MEDIUM in tone;
      every status and priority has a distinct icon.
- [ ] Every status/priority badge shows icon (aria-hidden) + localized label;
      tones follow 13-design-language.md exactly.
- [ ] Both apps' ticket-badges.ts maps deleted; no remaining callers.
- [ ] Specs cover all 8 enum values in en and ar (both apps' badges for what
      they render); ticket-enum-messages.spec.ts and the portal raw-enum guard
      stay green.
- [ ] Report status bars use the same tones as the badges.
- [ ] No layout changes to the views (badges swap in place).
- [ ] QA-02 screenshots captured (IN_PROGRESS on a hovered row, next to a
      primary button; light/dark); the outcome is recorded.
- [ ] shared/ui/web/portal typecheck + lint, ui/web/portal tests, web and
      portal builds pass.
- [ ] No backend/API/database/auth/routing change.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-1.14 depends on RD-1.8.
- **Depends on code areas or other stories:** Story 185 (Badge `info`/`progress` variants, `icon` prop). Downstream: RD-1.15 (SlaIndicator), RD-1.16 (portal priority label), RD-3.x/RD-4.x ticket screens.

## Extra notes (optional)

- Visual evidence with the track's Playwright harness (outside the repo).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/shared/src/ticket-presentation.ts` (+ `index.ts`), `packages/ui/src/lib/icons.ts` (+spec, index), web `components/tickets/ticket-badges.tsx` (+spec), portal `components/tickets/ticket-status-badge.tsx` (+spec), the call sites above, `report-charts.tsx` (+spec), delete both `lib/ticket-badges.ts` (+specs).

## Out of scope

- Portal priority labels/badge (RD-1.16), SLA presentation (RD-1.15), token value changes (QA-02 escalates instead), status editing controls (the web detail status Select), any backend/API/database/auth/routing change.
