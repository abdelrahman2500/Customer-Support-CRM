> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/closeout/closeout/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Closeout
- **Feature slug (folder under `plans/`):** `closeout`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-7.2**, global Story **235**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Closeout
```

---

## Description

```
Story 235 — PR-7.2 of the CRM product redesign (roadmap Phase 7), the last
Story of the track.

GOAL
Leave the redesign documented as shipped and demo-ready.

REQUIRED OUTCOME
1. docs/architecture/13-design-language.md matches what shipped: the shared
   status spine, portal chrome, Latin digits (with the explicit pin on
   Reports), mixed-direction text, the accessibility contract, a
   primitives and patterns index, and the visual baseline.
2. Stale doc comments that contradict the code corrected.
3. Unused message keys removed.
4. docs/demo-script.md: a presenter's walkthrough.
5. .squad/plans/00-index.md rows for Stories 210–235.
```

---

## Acceptance criteria

```
- [ ] Docs, comments, keys, demo script, index rows.
- [ ] Final validation: tests, typecheck, lint, builds, Playwright, visual compare.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 210–234.
- **Depends on code areas or other stories:** docs, `.squad/plans`, message files.

## Extra notes (optional)

- Nothing after this Story in the track.

## Technical hints (optional)

- Unused-key scan: a key path found nowhere in source (static or as a dynamic `prefix.${…}`), checked by hand.

## Out of scope

- New features.
