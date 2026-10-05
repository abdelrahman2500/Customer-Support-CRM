> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/insights-reports-audit/insights-reports-audit/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Insights: reports and audit log
- **Feature slug (folder under `plans/`):** `insights-reports-audit`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-4.7**, global Story **228**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Insights: reports and audit log
```

---

## Description

```
Story 228 — PR-4.7 of the CRM product redesign (roadmap Phase 4).

GOAL
Reports and the Audit log read as one product: one toolbar, shareable
filters, headline numbers, one clear failure state, and labels in the
reader's language.

REQUIRED OUTCOME
Reports
1. One toolbar: period, department, agent, category and the cross-branch
   rollup together (a Filters sheet on a phone), "Clear all", and the saved
   views beside them.
2. The filters and the selected saved view live in the URL.
3. A KPI row of StatCards (tickets, SLA compliance, average CSAT, average
   resolution time) from the queries the cards already make.
4. One page-level message when every report fails the same way (e.g. no
   report permission); per-card states stay when only some fail.
5. Localized units: currency and numbers use the UI locale with Latin
   digits (PD-8); durations use translated units.
Audit log
6. The shared list toolbar ("Clear all" also empties the text filters).
7. Named actions, HTTP verbs and entity types in the reader's language.
8. The change set opens in a Sheet with the entry's full record.
```

---

## Acceptance criteria

```
- [ ] Toolbar, URL filters, KPI row, page-level failure, localized units.
- [ ] Audit toolbar, localized labels, diff Sheet. Same API requests.
- [ ] en/ar, light/dark, 390/1280; web tests, lint, build, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 211, 221.
- **Depends on code areas or other stories:** `reports-view.tsx`, `audit-log-view.tsx`.

## Extra notes (optional)

- No backend change: the KPI row reads the existing report queries.

## Technical hints (optional)

- `useUrlFilters`, `ListToolbar`, `StatCard`, `ErrorState`, `Sheet`.

## Out of scope

- New reports or chart types; an actor picker for the audit log.
