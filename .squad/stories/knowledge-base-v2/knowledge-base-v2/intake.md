> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/knowledge-base-v2/knowledge-base-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Knowledge base (agent) v2
- **Feature slug (folder under `plans/`):** `knowledge-base-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-4.2**, global Story **223**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Knowledge base (agent) v2
```

---

## Description

```
Story 223 — PR-4.2 of the CRM product redesign (roadmap Phase 4; RD-4.7).

GOAL
An agent reads an article like an article; editing is a deliberate step.
The list matches the other v2 lists.

REQUIRED OUTCOME
1. Article detail opens in a read view (body at reading size and width,
   category, last update, Arabic translation status; read the Arabic
   translation when there is one, starting on the UI's language) with an
   explicit "Edit article" switching to today's editor (KB-01).
2. The editor's language tabs default to the UI locale (RTL-04).
3. List: the shared ListToolbar (live search kept, category FilterSelect,
   count, clear all); "filtered" includes the category; publish/unpublish
   in a row menu (its confirm kept).
4. Every edit and save path unchanged; kb-publish-portal-visibility green.
```

---

## Acceptance criteria

```
- [ ] Read mode default; Edit/Done switch; same saves.
- [ ] Editor tab follows the UI language.
- [ ] List toolbar, category-aware empty state, row menu.
- [ ] en/ar, light/dark, 390/1280; web/ui tests, lint, build, Playwright green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 211 (ListToolbar).
- **Depends on code areas or other stories:** `article-detail-view.tsx`, `article-list-view.tsx`.

## Extra notes (optional)

- `ListToolbar` gains `commitOnChange` (live search) for this list.

## Technical hints (optional)

- Attachments and version history stay visible in both modes.

## Out of scope

- Rich-text rendering (§10), AI-suggested articles.
