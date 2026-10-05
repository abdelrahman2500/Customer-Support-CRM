> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/dashboard-v2/dashboard-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Dashboard v2
- **Feature slug (folder under `plans/`):** `dashboard-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-3.6**, global Story **221**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Dashboard v2
```

---

## Description

```
Story 221 — PR-3.6 of the CRM product redesign (roadmap Phase 3; closes the
demo-ready milestone).

GOAL
"Your shift at a glance": the dashboard answers what needs me now, and
links straight into the board.

CONTEXT
- Story 144's summary row had two StatTiles (mine, unclaimed) from list
  totals, and refused an SLA count from loaded rows (under-reporting).
- The list API sorts by SLA urgency and returns totals; no SLA-state
  filter; reports need `report:read` (agents get 403).

REQUIRED OUTCOME
1. StatCards: mine, unclaimed (totals), at risk and breached among my
   tickets (counted on the urgency-ranked page, "N+" when it cannot be
   exact), each linking to the filtered board.
2. A status distribution bar of every visible ticket, legend entries
   linking to the list filtered by status.
3. "Needs you now": my most urgent tickets as mini cards (6), with a link
   to the rest on the board.
4. Unclaimed with Claim: long subjects wrap; Claim never pushed off.
5. Tasks unchanged.
6. For `report:read` users, the branch's last 30 days: SLA compliance and
   volume by category; hidden on 403.
```

---

## Acceptance criteria

```
- [ ] Figures link to the board; counts never silently under-report.
- [ ] Distribution, Needs you now, Unclaimed, Tasks, branch panel (403-safe).
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

- **Blocked by / related ids:** Stories 211 (StatCard, DistributionBar), 216 (board URL filters).
- **Depends on code areas or other stories:** `dashboard-view.tsx`, reporting hooks.

## Extra notes (optional)

- No time-series report endpoint exists, so "trends" are 30-day figures.

## Technical hints (optional)

- `useTicketStatusCounts`: one `pageSize: 1` list request per status.

## Out of scope

- New report endpoints, a permission model in the UI.
