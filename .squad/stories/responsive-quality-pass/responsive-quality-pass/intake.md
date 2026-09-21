> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/responsive-quality-pass/responsive-quality-pass/intake.md`

---

## Feature

- **Feature name (display):** Responsive quality pass
- **Feature slug (folder under `plans/`):** `responsive-quality-pass`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `150`
- **Work item type:** `story`
- **Status:** planned
- **Labels:** responsive, mobile, a11y, agent-workspace, portal

---

## Title

```
Responsive quality pass
```

---

## Description

```
Close out the UI/UX roadmap with a responsive quality pass over apps/web
and apps/portal.

This is explicitly NOT "add breakpoints everywhere". A component having no
breakpoint is not a defect. The task is to find concrete responsive UX
problems at realistic viewport widths and fix the ones that materially
affect usability, using the app's existing conventions.

Recon measured one dominant defect. RM-10 gave `Table` a dual layout:
a real table at sm and up, a stacked card per row below it, with
`TableHeader` hidden and `TableCell`'s `label` prop carrying the column
name instead. RM-10 converted three tables and stopped. Across both apps
there are 93 TableCell call sites and only 17 carry a label, in 3 of 17
table-bearing files. Every other table is an anonymous stack of values on
a phone — my-sessions shows two unlabelled dates, SLA policies shows two
indistinguishable durations, the audit log shows eight bare lines.

Fix that, using the primitive's own designed contract.
```

---

## Acceptance criteria

```
- Every data TableCell in both apps carries a label matching its own
  column header, sourced from the same i18n key as that header.
- Action-only cells and colSpan detail rows deliberately carry none.
- Desktop (sm and up) rendering is byte-identical everywhere.
- A guard test fails if a future data cell ships without a label.
- No token or RTL guard regresses; no physical-direction utility added.
- No behaviour, routing, authorization or API change.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** RM-10 (the mobile table primitive), 149 (introduced one unlabelled cell)
- **Depends on code areas or other stories:** `packages/ui/src/components/table.tsx`,
  every `*-view.tsx` rendering a `Table` in `apps/web` and `apps/portal`.

## Extra notes (optional)

- Candidates investigated and rejected on evidence (zero non-responsive
  grids, zero `whitespace-nowrap`, wrapping filter rows, dialogs already
  gutter-safe, no `DialogContent` call sites, charts already fixed in 146)
  are recorded in the plan's Non-goals so the negative result is not lost.

## Technical hints (optional)

- Reuse the `<TableHead>`'s own translation key for the sibling cell's
  `label`, so the two cannot drift.
- The label span is `sm:hidden`, so desktop cannot change.

## Out of scope

- Adding breakpoints to components that have none but are already fluid.
- Any redesign, new primitive, or new breakpoint system.
- A mobile sort control (RM-10 disclosed its absence as deliberate).
