> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-shell-v2/agent-shell-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent shell v2
- **Feature slug (folder under `plans/`):** `agent-shell-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-2.1**, global Story **213**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Agent shell v2
```

---

## Description

```
Story 213 — PR-2.1 of the CRM product redesign (roadmap Phase 2;
visual-direction.md §3 "Ink chrome", §6 "Agent shell"; decision PD-10).

GOAL
The agent workspace gets its signature silhouette: an ink chrome header
band and rail framing the warm canvas, a clearer navigation grouping, and
a real mobile drawer instead of a long dropdown.

CONTEXT (main @ 9cc85a8)
- WorkspaceShell renders WorkspaceHeader plus either WorkspaceNavbar
  (default NAVBAR layout) or WorkspaceSidebar (SIDEBAR, an admin setting
  covered by Playwright admin-navigation-layout).
- Header: light surface, border-b-2 border-brand (Tier 1), hamburger
  DropdownMenu below sm, New ticket, notifications bell, user Popover.
- nav-items.tsx: 6 groups (workspace, ticketingConfig, reporting,
  administration, system, account), 20 items, used by all three surfaces.
- Story 210 added the chrome tokens, .on-chrome focus scope and recipes;
  Story 211 the Sheet; Story 212 the chrome Button variant.

REQUIRED OUTCOME
1. Header = ink chrome band (brand edge kept); bell, user menu and
   hamburger use the chrome button variant.
2. Sidebar rail = ink chrome, continuous with the header; navbar row =
   chrome band; one chrome nav-item treatment (active: chrome-active +
   brand edge) shared by rail and navbar triggers.
3. Below sm: the hamburger opens a Sheet drawer from the reading side with
   the same grouped navigation (RailNav, shared with the rail); it closes
   on navigation and has a named close button.
4. PD-10 regrouping: Work / Insights / Configure / Admin / Account — the
   same 20 items, routes, labels and icons.
```

---

## Acceptance criteria

```
- [ ] Same routes and items in every surface (existing guards); focus
      visible on chrome; drawer keyboard-closable, named, RTL-mirrored.
- [ ] Spec updates only where the approved change requires (group keys,
      chrome classes, drawer instead of menu) with recorded reasons; new
      cases for the chrome band, rail and drawer.
- [ ] Playwright admin-navigation-layout (group names), agent-resolves-
      ticket and session-expiry green; harness 390/768/1280 × en/ar ×
      light/dark: chrome header + rail, 0 overflow.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:** Stories 129, 195–197, 210–212.

## Extra notes (optional)

- Global loading/not-found/error pages reviewed: already on ErrorState (Story 199) and the v2 tokens; unchanged.

## Technical hints (optional)

- Files: `apps/web/src/components/workspace/{nav-items,workspace-header,workspace-navbar,workspace-sidebar}.tsx` (+specs), `apps/web/messages/{en,ar}.json`, `apps/e2e/tests/admin-navigation-layout.spec.ts`.

## Out of scope

- Permission-gated nav (D6), new routes, login (PR-2.2), portal header (PR-5.1).
