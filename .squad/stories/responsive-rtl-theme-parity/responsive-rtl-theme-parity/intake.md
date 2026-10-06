> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/responsive-rtl-theme-parity/responsive-rtl-theme-parity/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Responsive, RTL and theme parity
- **Feature slug (folder under `plans/`):** `responsive-rtl-theme-parity`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-6.2**, global Story **233**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Responsive, RTL and theme parity
```

---

## Description

```
Story 233 — PR-6.2 of the CRM product redesign (roadmap Phase 6).

GOAL
Verify every route at every reference size, in both languages and both
themes, with the four reference brands; fix only the gaps found.

REQUIRED OUTCOME
1. Every route (32 web + 8 portal + both logins) × 390/768/1280/1440 ×
   en/ar × light/dark: no horizontal overflow, one h1, no page errors, and
   no Arabic-Indic digits in Arabic (PD-8: numbers, dates and charts keep
   Latin digits).
2. Four reference brands (default indigo, passing green, failing yellow,
   failing red) × light/dark on the shell's hero screens: no colour-contrast
   violations; the branding is restored afterwards.
3. Mixed-direction text: user-written single-line text (subjects, titles,
   names, page titles, senders) is isolated with <bdi>; multi-line user
   text (messages, article bodies, CSAT comments) takes its direction from
   its content (dir="auto"). This fixes punctuation landing on the wrong
   side (e.g. "?This should be fixed now" in the Arabic UI).
```

---

## Acceptance criteria

```
- [ ] Parity matrix clean; brand matrix clean; bdi/dir=auto applied.
- [ ] ui/web/portal tests, lint, typecheck, builds, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 232.
- **Depends on code areas or other stories:** `@crm/ui` `PageHeader`, `MessageBubble`; list/card/header components in both apps.

## Extra notes (optional)

- The brand check PATCHes the demo branch's own branding through the existing admin API and restores it in a `finally`.

## Technical hints (optional)

- `<bdi>` keeps the parent's alignment; `dir="auto"` sets a paragraph's direction (and alignment) from its first strong character.

## Out of scope

- A configured logo (the demo branch has none); the logo plate was verified in Story 184.
