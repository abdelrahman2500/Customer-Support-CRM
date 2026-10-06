> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/visual-regression-baseline/visual-regression-baseline/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Visual regression baseline
- **Feature slug (folder under `plans/`):** `visual-regression-baseline`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-7.1**, global Story **234**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Visual regression baseline
```

---

## Description

```
Story 234 — PR-7.1 of the CRM product redesign (roadmap Phase 7, decision PD-9).

GOAL
A local screenshot baseline for the hero screens, so a visual regression
is caught before it is committed.

REQUIRED OUTCOME
1. Playwright toHaveScreenshot for the web login, portal login, dashboard,
   board, ticket, portal home and portal ticket × en/ar × light/dark ×
   1280/390 (56 screenshots), with committed baselines.
2. Local only: a separate config and scripts (test:visual,
   test:visual:update); CI keeps running only ./tests.
3. Reproducible: documented reseed-then-run, digits normalised before each
   capture (demo timestamps move with each seed), 1% pixel tolerance.
```

---

## Acceptance criteria

```
- [ ] 56 baselines committed; two consecutive compares pass.
- [ ] CI config untouched; e2e typecheck/lint clean; Playwright suite 10/10.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 232, 233.
- **Depends on code areas or other stories:** `apps/e2e`; the demo dataset (Story 215).

## Extra notes (optional)

- Baselines are renderer- and font-specific: re-baseline on a new machine.

## Technical hints (optional)

- `snapshotPathTemplate: {testDir}/__screenshots__/{arg}{ext}`.

## Out of scope

- CI gating (PD-9).
