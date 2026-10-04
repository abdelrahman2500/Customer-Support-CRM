> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/sla-indicator/sla-indicator/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** SlaIndicator
- **Feature slug (folder under `plans/`):** `sla-indicator`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-1.15**, global Story **192**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
SlaIndicator
```

---

## Description

```
Story 192 — RD-1.15 "SlaIndicator" of the CRM UI/UX redesign track (roadmap:
.squad/plans/crm-ui-ux-redesign/00-overview.md §6 "RD-1.15", component row
"SlaIndicator (+ at-risk tier, which-target label, localized duration)";
decision D3 (at-risk threshold); binding semantics:
docs/architecture/13-design-language.md "Status semantics" — SLA on-track →
neutral · at-risk → warning · breached → danger · on-hold → neutral; at-risk
is a presentation tier only: the governing target has ≤ 25% of its window
(measured from ticket creation) or ≤ 60 minutes remaining, whichever comes
first; it changes no business rule).

GOAL
One web component for a ticket's SLA state, replacing three hand-rolled
renderings, that also says WHICH target governs (response vs resolution),
shows the at-risk tier, and localizes the duration (no Latin "h"/"m" in
Arabic).

CONTEXT (verified at HEAD 653ce4f)
- apps/web/src/lib/sla.ts: deriveSlaStatus(target, now) → none | breached
  {targetAt} | on-track {targetAt, remainingMs} | on-hold {onHoldSince};
  the earlier of responseTargetAt/resolutionTargetAt governs.
  formatRemaining(ms) → "2h 15m"/"45m"/"<1m" (Latin units in every locale).
  Spec: lib/sla.spec.ts.
- Three renderings: ticket-list-view.tsx SlaCell (~line 79), dashboard-view.tsx
  SlaPresentation (~83), ticket-detail-view.tsx inline SLA SectionCard
  (~690–715: breachedAt with time, remaining, onHoldSince with time).
- Messages: tickets.sla.{none, breached, breachedAt, remaining, onHold,
  onHoldSince, …} in en/ar. No duration unit keys exist.
- List rows (TicketListItem) and the detail ticket both carry createdAt.
- reports-view.tsx also uses formatRemaining for the average resolution time
  (not an SLA indicator — outside RD-1.15's named scope).

REQUIRED OUTCOME
1. sla.ts reports the governing target ("response" | "resolution") for
   breached/on-track and an `atRisk` flag on on-track per D3 (window =
   governing target − ticket createdAt; without createdAt only the 60-minute
   rule applies). Pure; no business-rule change.
2. Duration localized through i18n unit keys with the locale's own digits
   (D4: keep the current `Intl` `ar` behaviour).
3. SlaIndicator (apps/web/src/components/tickets/sla-indicator.tsx):
   compact (list, dashboard) and detail variants; none → subtle text;
   on-track → neutral text "Response due in 2h 15m"; at-risk → warning badge
   + icon (+ "At risk" for screen readers); breached → danger badge + icon
   "Response breached" (detail: "… at {time}"); on-hold → neutral badge
   (detail: "since {time}").
4. Replace SlaCell, SlaPresentation and the detail inline rendering.
```

---

## Acceptance criteria

```
- [ ] All four existing kinds render the same information as today plus the
      governing-target label.
- [ ] At-risk appears per the D3 threshold (boundary specs: 25% of window,
      60 minutes, whichever first).
- [ ] Arabic output contains no Latin h/m (spec).
- [ ] Meaning never colour-only: at-risk and breached carry an icon; at-risk
      has screen-reader text.
- [ ] No overflow at 320px on the ticket list, dashboard and detail.
- [ ] sla.ts specs (boundaries), SlaIndicator specs (en/ar, all kinds), view
      specs green; web tests, typecheck, lint, build pass.
- [ ] No live ticking countdown; no API/backend change.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-1.15 depends on RD-1.8 and decision D3 (approved).
- **Depends on code areas or other stories:** Story 185 (Badge `icon`, tones), Story 191 (badges in the same rows).

## Extra notes (optional)

- Visual evidence with the track's Playwright harness (outside the repo).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `apps/web/src/lib/sla.ts` (+spec), new `apps/web/src/components/tickets/sla-indicator.tsx` (+spec), `ticket-list-view.tsx`, `dashboard-view.tsx`, `ticket-detail-view.tsx`, `messages/{en,ar}.json`.

## Out of scope

- The reports average-resolution duration (reports-view; later reporting Story), live countdowns, any API/backend/business-rule change, the portal (shows no SLA).
