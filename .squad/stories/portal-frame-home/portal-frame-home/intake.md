> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/portal-frame-home/portal-frame-home/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Portal frame and home
- **Feature slug (folder under `plans/`):** `portal-frame-home`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-5.1**, global Story **229**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Portal frame and home
```

---

## Description

```
Story 229 — PR-5.1 of the CRM product redesign (roadmap Phase 5).

GOAL
The portal gets its own, lighter version of the product's chrome and a
home page built around what a customer comes to do.

REQUIRED OUTCOME
1. Frame: a white header with the brand stripe along its top; header row
   and content share one reading width; the hamburger covers tablet widths
   where six links no longer fit.
2. Branding read server-side (as the agent app does) and seeded into the
   branding query, so the first paint already has the logo and colour.
3. Home: three action cards (raise a ticket, search help articles, ask the
   assistant); recent tickets as cards with the same status spine agents
   see; help highlights beside them on a wide screen.
4. The status spine moves to @crm/ui (toneSpine) so both apps share it.
```

---

## Acceptance criteria

```
- [ ] Header stripe, reading width, SSR branding, action cards, spine cards.
- [ ] No new endpoint; existing routes only.
- [ ] en/ar, light/dark, 390/768/1024/1280; portal/web/ui tests, lint, build, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 211, 214, 216.
- **Depends on code areas or other stories:** `portal-header.tsx`, `portal-home-view.tsx`, `(customer)/layout.tsx`, web `board-state.ts`.

## Extra notes (optional)

- No status breakdown on home: the portal list endpoint has no status filter (Story 136's reasoning stands).

## Technical hints (optional)

- `fetchBranding()` mirrors `apps/web/src/lib/branding-server.ts` against `/portal/branding`.

## Out of scope

- Portal tickets, help and account screens (Stories 230, 231).
