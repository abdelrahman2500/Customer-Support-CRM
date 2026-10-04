> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/navigation-surfaces-restyle/navigation-surfaces-restyle/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Navigation surfaces restyle
- **Feature slug (folder under `plans/`):** `navigation-surfaces-restyle`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-2.2**, global Story **196**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-2-app-shell`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Navigation surfaces restyle
```

---

## Description

```
Story 196 — RD-2.2 "Navigation surfaces restyle" of the CRM UI/UX redesign
track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 2
"RD-2.2"; design language: Tier 1 brand on "active-nav indicator", icons
"20px navigation"; recon A11Y-11 (navbar trigger masks the unread count);
QA-03 (focus and selection share one hue)).

GOAL
Presentation-only restyle of the navbar, the sidebar rail and the shared nav
item label: neutral active state with the Tier 1 brand indicator, 20px rail
icons, label-style group headings, design-language radius, a quieter rail
toggle, and the unread count in the navbar trigger's accessible name.

CONTEXT (verified at HEAD fd2088f)
- workspace-navbar.tsx: six DropdownMenu group triggers; active trigger
  `border-accent bg-accent-surface`; trigger aria-label
  `nav.groupMenuLabel` masks the Badge's own aria-label (A11Y-11).
- workspace-sidebar.tsx: rail (w-60 / collapsed w-16, localStorage),
  headings `text-xs font-semibold`, links `rounded-md border-s-2`, active
  `border-accent bg-accent-surface`; toggle `Button variant=outline size=sm`;
  collapsed tooltips on the content side.
- nav-items.tsx NavItemLabel: icon `h-4 w-4` (menus pull it in with
  `-ms-4 me-4`).
- --brand (Tier 1) exists in tokens; header edge already uses border-brand.
- Specs assert `border-accent` on active trigger/link (navbar ~209, sidebar
  ~173).

REQUIRED OUTCOME
1. Active (navbar trigger, rail link): `border-brand bg-surface-muted
   font-medium text-ink-strong` + aria-current (links) — neutral selection,
   brand indicator.
2. Rail icons 20px; dropdown-menu rows keep 16px (inline menu rows).
3. Rail group headings `text-label`, no uppercase.
4. `rounded-control`; rail toggle ghost icon button.
5. Navbar trigger accessible name includes the unread count when known.
```

---

## Acceptance criteria

```
- [ ] NAV_GROUPS order, hrefs, labels and active-route rules unchanged
      (existing nav specs pass, except the intentional active-class change).
- [ ] Active = brand indicator + neutral fill + aria-current; never colour-
      only (reserved border + weight).
- [ ] Rail tooltips still follow text direction; collapsed rail keeps
      accessible names.
- [ ] Navbar trigger name carries the unread count (A11Y-11).
- [ ] Web tests, typecheck, lint, build; Playwright admin-navigation green;
      RTL/dark screenshots.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-2.2 depends on RD-1.6.
- **Depends on code areas or other stories:** Story 183 (brand tiers), Story 195 (header).

## Extra notes (optional)

- QA-03: selection moves off the accent hue (neutral fill + brand bar), so focus (indigo ring) and selection no longer share a hue family when a branch brand differs; with the default brand both remain distinguishable by shape.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `workspace-navbar.tsx`, `workspace-sidebar.tsx`, `nav-items.tsx` (+specs), `apps/web/messages/{en,ar}.json`.

## Out of scope

- IA, grouping, permission changes; header (RD-2.1 done); portal.
