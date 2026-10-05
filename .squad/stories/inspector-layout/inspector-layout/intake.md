> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/inspector-layout/inspector-layout/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Inspector layout
- **Feature slug (folder under `plans/`):** `inspector-layout`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.3**, global Story **203**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `packages/ui`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Inspector layout
```

---

## Description

```
Story 203 — RD-3.3 "Inspector layout" of the CRM UI/UX redesign track
(roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 3 "RD-3.3";
recon TW-02 (side column not sticky), TW-07 (untitled properties card)).

GOAL
The ticket page's side column becomes an inspector: sticky beside the
conversation and independently scrollable at lg, made of titled,
collapsible sections (Properties, Customer, SLA, Escalations, CSAT), open
by default.

CONTEXT (verified at HEAD dc3937e)
- ticket-detail-view.tsx side column: an UNTITLED Card holding the five
  Field-wrapped Selects (status, priority, category, assignee, department)
  — breaks the heading outline (TW-07); then CustomerContextPanel
  (SectionCard "detail.contextPanelHeading", own component), SLA SectionCard
  (+ hold/resume), Escalations, History, CSAT SectionCards. Not sticky; the
  whole page scrolls (TW-02).
- TicketHeader (Story 201) is sticky at lg:top-0 with a variable height.
- packages/ui SectionCard: title (h2 default), headingLevel, actions,
  elevation; "adds no DOM node" over Card (tests rely on node counts). No
  collapsible mode; no Radix Collapsible dependency installed.
- Field = <label> wrapping each Select (Playwright getByLabel("Status")).
- Phase 3 section-survival guard in ticket-detail-view.spec.tsx.

REQUIRED OUTCOME
1. SectionCard `collapsible` (+ defaultOpen, default true): a disclosure
   button inside the heading (aria-expanded/aria-controls), body in a region
   hidden when collapsed; no extra node unless collapsible.
2. Properties: the untitled Card becomes SectionCard "Properties" (h2) with
   the same Field controls plus a DescriptionList of the full ticket id.
3. Inspector: lg sticky below the sticky ticket header (its measured height
   as a CSS variable), max-height to the viewport, overflow-y auto.
4. Collapsible: Properties, Customer, SLA, Escalations, CSAT; client-only
   state; all open by default.
```

---

## Acceptance criteria

```
- [ ] Every field and control from today is present (guard); heading outline
      h1 → h2 sections; nothing hidden by default above the fold.
- [ ] Collapsing a section hides its body and restores it on expand;
      keyboard operable; aria-expanded reflects state.
- [ ] At 1280 the inspector stays beside the conversation while the page
      scrolls and scrolls on its own; no overflow at 320/768/1280.
- [ ] SectionCard non-collapsible output byte-identical (ui spec).
- [ ] Playwright ticket specs green; web/ui tests, typecheck, lint, build.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.3 depends on RD-3.1, RD-1.10, RD-1.12.
- **Depends on code areas or other stories:** Stories 201, 202.

## Extra notes (optional)

- Control replacement (Combobox) is RD-3.4; History moves into the timeline in RD-3.6 (left non-collapsible here).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/card.tsx` (+spec), `ticket-detail-view.tsx` (+spec), `customer-context-panel.tsx`, `apps/web/messages/{en,ar}.json`.

## Out of scope

- Control replacement (RD-3.4), timeline (RD-3.6), persistence of collapse state, any backend change.
