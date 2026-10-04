> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-header-v2/agent-header-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent header v2 and user menu
- **Feature slug (folder under `plans/`):** `agent-header-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-2.1**, global Story **195**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-2-app-shell`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Agent header v2 and user menu
```

---

## Description

```
Story 195 — RD-2.1 "Agent header v2 and user menu" of the CRM UI/UX redesign
track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md §6 Phase 2
"RD-2.1"; recon NAV-04, A11Y-11; Story 173's 320px multi-membership case).

GOAL
A modern agent header: brand block + brand stripe, a "New ticket" primary
action, a notifications bell with its unread count in the accessible name,
and one user menu (Avatar + name) that holds the branch switcher, language,
theme, My sessions, Settings and Sign out. Below sm the hamburger joins the
header row instead of being a third stacked bar.

CONTEXT (verified at HEAD 8d2e95f)
- apps/web/src/components/workspace/workspace-header.tsx (334 lines): brand
  (logo img or app-name Link, Story 129 appName fallback), "signed in as",
  branch NativeSelect (memberships > 1, Story 118 error handling), language
  NativeSelect (Story 119 persist + push), ThemeSwitcher, Sign out (Story 41
  logout → clear token → clear cache → push login), the realtime banner, and
  the RM-11 hamburger DropdownMenu in its own sm:hidden bar (NAV-04).
  Story 173 made the header wrap at 320px.
- Props from WorkspaceShell: user, branding, unreadCount, unreadCountKnown.
- Primitives: Avatar (Story 189), Popover (Story 187), Button asChild,
  NotificationsIcon/AddIcon, NativeSelect, ThemeSwitcher.
- Routes exist: /tickets/new, /notifications, /my-sessions, /settings.
- workspace-header.spec.tsx (818 lines) queries the controls directly; the
  Playwright e2e specs do not use any header control (they use the nav and
  the login form).
- The unread badge in nav items carries aria-label on a span (A11Y-11).

REQUIRED OUTCOME
1. Header row: [hamburger <sm] [brand] … [New ticket] [bell] [user menu].
2. User menu = Popover (a labelled dialog, not a Radix menu: it holds form
   controls) with the identity, branch switcher, language, theme, My
   sessions, Settings, Sign out. All existing behaviours unchanged.
3. Bell: link to /notifications, accessible name "Notifications" or
   "Notifications, N unread"; the visual count is aria-hidden.
4. 320px: no overflow in en/ar incl. multiple memberships.
```

---

## Acceptance criteria

```
- [ ] Every current control still reachable: branch switch, locale, theme,
      sign out (now in the user menu); behaviours unchanged (specs).
- [ ] New ticket and notifications reachable from the header on every page.
- [ ] Bell's accessible name includes the unread count (A11Y-11, header).
- [ ] Hamburger in the header row below sm (NAV-04).
- [ ] No horizontal overflow at 320px, en and ar, with multiple memberships.
- [ ] Focus rings on every header control; keyboard: Escape closes the menu
      and returns focus to its trigger.
- [ ] Header spec updated for the intentional moves; nav/shell specs and
      Playwright admin-navigation + session-expiry stay green.
- [ ] No backend/API/auth/routing/permission change.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-2.1 depends on RD-1.5 and RD-1.12.
- **Depends on code areas or other stories:** Story 182 (NativeSelect), Story 187 (Popover), Story 189 (Avatar).

## Extra notes (optional)

- Portal header is RD-2.6; nav restyle RD-2.2.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `workspace-header.tsx` (+spec), `apps/web/messages/{en,ar}.json`.

## Out of scope

- Global search, command palette, permission-gated nav, portal header, any backend/API/auth/routing change.
