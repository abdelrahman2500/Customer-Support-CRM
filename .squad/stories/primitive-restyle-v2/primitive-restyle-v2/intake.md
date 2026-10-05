> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/primitive-restyle-v2/primitive-restyle-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Primitive restyle to v2
- **Feature slug (folder under `plans/`):** `primitive-restyle-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-1.3**, global Story **212**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Primitive restyle to v2
```

---

## Description

```
Story 212 — PR-1.3 of the CRM product redesign (roadmap Phase 1;
visual-direction.md §3–§5).

GOAL
The existing primitives speak the v2 language before screens adopt it:
borders before shadows, quiet empty states, an "unassigned" avatar for
board cards, and a button that belongs on the ink chrome.

CONTEXT (main @ df46c17)
- Card elevation "raised" = shadow-resting (3 call sites); v2 says
  resting surfaces never cast a shadow.
- EmptyState is a dashed box (reads as a drop target).
- Avatar has no "nobody assigned" form; the board card needs one.
- Button has no variant for the chrome rail (PR-2.1).
- Table (row hover, selected), Badge, Tabs, Skeleton, Toast already match
  the v2 recipes and stay as they are.

REQUIRED OUTCOME
1. Card raised → the stronger hairline (border-rule-strong), no shadow.
2. EmptyState → quiet tinted panel; icon disc on the surface + hairline.
3. Avatar variant="unassigned": dashed placeholder, person glyph, named.
4. Button variant="chrome" (chrome-muted → chrome-ink on chrome-raised).
5. UnassignedIcon in the icon vocabulary.
```

---

## Acceptance criteria

```
- [ ] Behaviour unchanged; the 3 assertions tied to the old look (card
      shadow ×2, empty-state disc) updated with recorded reasons.
- [ ] New cases for each new variant; ui/web/portal tests, typecheck,
      lint, builds green; harness shows no regression.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:** Stories 210, 211.

## Extra notes (optional)

- Badge, Tabs, Table, Skeleton, Toast reviewed: already on the v2 recipes.

## Technical hints (optional)

- Files: `packages/ui/src/components/{card,empty-state,avatar,button}.tsx` (+specs), `packages/ui/src/lib/icons.ts` (+spec), `packages/ui/src/index.ts`.

## Out of scope

- Screen changes (later Stories).
