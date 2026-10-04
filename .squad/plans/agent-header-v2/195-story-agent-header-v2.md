# Story 195 — Agent header v2 and user menu

> CRM UI/UX redesign roadmap item **RD-2.1**. Intake: [`../../stories/agent-header-v2/agent-header-v2/intake.md`](../../stories/agent-header-v2/agent-header-v2/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 2 "RD-2.1"; recon NAV-04, A11Y-11; Story 173 (320px with multiple memberships).

---

## Prerequisites

- Story 182 (`NativeSelect`, `ThemeSwitcher`), Story 187 (`Popover`, overlay surfaces), Story 189 (`Avatar`), Story 185 (`Button` sizes, icons).
- Routes already exist: `/tickets/new`, `/notifications`, `/my-sessions`, `/settings`. No route is added.

---

## Story Goal

Rebuild `WorkspaceHeader` as a single row:

- **Start:** the hamburger (below `sm` only; NAV-04), then the brand block (logo or app name, as today). The brand stripe stays as `border-b-2 border-brand`.
- **End:**
  - a **New ticket** primary action (a link to `/tickets/new`);
  - a **notifications bell** (a link to `/notifications`) whose accessible name carries the unread count (A11Y-11 for the header);
  - a **user menu** trigger: Avatar plus first name (the name is hidden below `sm`).

The user menu holds:
- the identity ("Signed in as …")
- the branch switcher
- language
- theme
- My sessions
- Settings
- Sign out

**Non-goals:**
- global search, command palette, permission-gated navigation
- the portal header (RD-2.6)
- nav surface restyle (RD-2.2)
- any change to sign-out, branch-switch or locale-switch behaviour
- any backend, API, auth or routing change

---

## Design decisions

1. **The user menu is a `Popover`, not a `DropdownMenu`.**
   - It contains two native `<select>`s and the theme select. A Radix menu's roving focus and typeahead would capture their keys, and `menuitem` is the wrong role for a form control.
   - A Popover is a non-modal dialog. Tab moves through its controls, and Escape closes it and returns focus to the trigger (Radix).
   - It is labelled by the trigger's name, and the content gets `aria-label={t("userMenu.label")}`.
2. **The trigger** is a `Button variant="ghost"` with `Avatar` (decorative) plus `<span className="hidden sm:inline">{user.fullName}</span>`.
   - Its accessible name is `t("userMenu.trigger", { name })`: "Account menu for {name}".
   - The `focus-ring` comes from Button.
3. **New ticket:** `Button asChild size="sm"` around `<Link href="/{locale}/tickets/new">`, with `AddIcon`.
   - The text is `sr-only` below `sm` and visible from `sm`, so it stays an icon-sized button on phones and keeps its accessible name.
   - The label reuses the existing `tickets.list.newTicketButton` wording through a new `workspace.header.newTicket` key, since the header owns its own namespace.
4. **The bell** is `Button asChild variant="ghost" size="icon"` around `<Link href="/{locale}/notifications">`, with `NotificationsIcon`.
   - `aria-label` is `t("header.notifications")` while the count is unknown or zero, and `t("header.notificationsUnread", { count })` otherwise.
   - The visual count is a small `Badge` with `aria-hidden`, so it is not read twice.
5. **Hamburger:** the same `DropdownMenu` and the same items, moved into the header row's start cluster with `sm:hidden`. The separate `sm:hidden` bar is removed (NAV-04).
6. **Branch-switch error** renders inside the popover, in the same `role="alert"` span, because that is where the switch happens.
7. **Behaviour is unchanged:** `handleSignOut`, `handleSwitchBranch`, `handleSwitchLocale`, `buildLocalePath`, the realtime banner and `useMentionNotifications` are kept verbatim.
8. **320px budget.** Header `px-4 sm:px-6`. The row is hamburger 36 + brand (`min-w-0 truncate`, elastic) + New ticket 36 + bell 36 + avatar trigger 40 + 3 × 8 gaps, about 172px + brand, within the 288px content width. No wrapping is needed. Every control in the popover is full-width inside a `w-72` content box, capped by Radix collision padding.

---

## Context — Read These Files First

1. `apps/web/src/components/workspace/workspace-header.tsx` (the whole file) and `workspace-header.spec.tsx` (the whole file).
2. `packages/ui/src/components/popover.tsx`, `avatar.tsx`, `button.tsx` (`asChild`, sizes), `theme-switcher.tsx`, `native-select.tsx`.
3. `apps/web/src/components/workspace/workspace-shell.tsx`, which passes the props.
4. `apps/web/messages/{en,ar}.json`: `workspace.*`.
5. `apps/e2e/tests/admin-navigation-layout.spec.ts`, `session-expiry-and-refresh.spec.ts`.

---

## Tasks

1. **Messages, en and ar:**
   - `workspace.header.newTicket`
   - `workspace.header.notifications`
   - `workspace.header.notificationsUnread` (`{count}`)
   - `workspace.userMenu.label`
   - `workspace.userMenu.trigger` (`{name}`)

   My sessions and Settings reuse `workspace.nav.mySessions` / `workspace.nav.settings`.
2. **Rewrite the header's JSX** per design decisions 1–6. Keep the handlers, the brand logic and every Story comment that still applies; drop the comments about the removed bar and the Story 173 wrapping clusters.
3. **Update the specs** (intentional moves):
   - add `openUserMenu()`;
   - the sign-out, branch, language and theme cases open the menu first;
   - Story 173's wrap/class cases are rewritten to the new contract: no `hidden` on controls, logical classes only, the brand truncates;
   - RM-11 cases are unchanged (same toggle name).
4. **New spec cases:**
   - New ticket links to `/{locale}/tickets/new`, under `/ar` too;
   - the bell's name without a count, with an unknown count, and with a count;
   - the badge is `aria-hidden`;
   - the user menu holds every control;
   - Escape closes it and focus returns to the trigger;
   - the hamburger is inside `<header>`.

---

## Edge Cases & Failure Modes

- **One membership:** no branch switcher in the menu, as today.
- **A long name:** the trigger's name `truncate`s with `max-w-40`; the avatar initials are grapheme-safe (Story 189).
- **A logo configured:** the same `<img>` with its below-`sm` cap.
- **RTL:** the start/end clusters are logical (`justify-between`, `ms-auto`), and the popover aligns `end`, so it opens toward the inline start in RTL.
- **Sign out while the popover is open:** the handler runs, then the route changes and the popover unmounts with the page.
- **Unread count unknown:** the bell has no badge, and its name is "Notifications".

---

## Test Plan

- `workspace-header.spec.tsx` updated and extended (tasks 3–4).
- `workspace-shell.spec.tsx`, `workspace-navbar.spec.tsx`, `workspace-sidebar.spec.tsx` and `nav-items.spec.tsx` unchanged and green.
- Playwright: `admin-navigation-layout.spec.ts` and `session-expiry-and-refresh.spec.ts` against the production servers.

---

## Verification Steps

1. Web tests, typecheck and lint; prettier only on the changed files.
2. Web build.
3. Playwright: the two specs above.
4. Harness at 320 and 1280 × en/ar × light/dark, with an admin who has multiple memberships where available. Check:
   - no overflow;
   - the user menu opens, holds every control, and closes on Escape with focus restored;
   - the bell's name;
   - New ticket navigates.
5. Run `git diff --check`, review the diff, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] The header row with brand, New ticket, bell and user menu; the hamburger in the row below `sm`.
- [ ] Every previous control reachable, with unchanged behaviour.
- [ ] The bell's accessible name carries the count; the visual badge is `aria-hidden`.
- [ ] 0 overflow at 320 in en/ar, including multiple memberships; focus rings; Escape restores focus.
- [ ] Specs updated and extended; nav and shell specs and the two Playwright specs green; build passes.
- [ ] No backend, API, auth or routing change.
