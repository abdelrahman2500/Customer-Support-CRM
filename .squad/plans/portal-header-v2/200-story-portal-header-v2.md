# Story 200 — Portal header v2

> CRM UI/UX redesign roadmap item **RD-2.6**. Intake: [`../../stories/portal-header-v2/portal-header-v2/intake.md`](../../stories/portal-header-v2/portal-header-v2/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 2 "RD-2.6"; recon PT-03, RS-06, A11Y-11.

---

## Prerequisites

- **Story 195** (`4139f2a`, RD-2.1): the agent header pattern (one row, Popover user menu, count in the link name).
- Story 189 (`Avatar`), Story 187 (`Popover`), Story 182 (`NativeSelect`/`ThemeSwitcher`), Story 183 (`BrandScope`/`border-brand`).

---

## Story Goal

Rebuild `PortalHeader` as one row:

- **Start:** the hamburger (below `sm`), then the **brand block**. It links to `/home` and shows the logo (capped at `max-w-32` below `sm`) or `common.appName`, with `min-w-0 truncate` and a `focus-ring`.
- **Middle:** the desktop **nav**, from `sm`: **Home** (new), Tickets, Knowledge Base, Chat, Notifications and Account.
- **End:** the **user menu**, an Avatar plus the name (the name is hidden below `sm`). It is a Popover with "Signed in as …", language, theme and Sign out.

The Notifications link (in both the desktop nav and the hamburger) carries the unread count in its own accessible name, and the visual badge is `aria-hidden` (A11Y-11).

**Non-goals:**
- server-side branding (RD-5.1)
- new destinations other than Home
- changes to sign-out or locale behaviour
- any backend change

---

## Design decisions

1. **The same structure and rationale as Story 195.** It is a Popover, not a menu, because it holds native selects. Escape restores focus to the trigger.
2. **Brand block.**
   - The `<Link href="/{locale}/home" className="focus-ring flex min-w-0 items-center gap-2 rounded-inner">` contains either the `<img>` (alt `home.logoAlt`, `h-8 w-auto max-w-32 sm:max-w-none object-contain`) or `<span className="truncate font-semibold text-ink">{tCommon("appName")}</span>`.
   - "Signed in as {name}" moves into the user menu, so the name no longer doubles as Home (PT-03).
3. **Home nav item:** `{ href: /{locale}/home, label: t("nav.home") }`, first. Its active rule is the existing `isActiveHref`.
4. **Notifications item.** When the count is known and non-zero:
   - the link gets `aria-label={tNotifications("navUnread", { count })}` ("Notifications, {count} unread");
   - the Badge is `aria-hidden`.

   The existing `unreadNotificationsLabel` key stays, so nothing else changes.
5. **New messages (en/ar):**
   - `home.nav.home`: "Home" / "الرئيسية"
   - `home.userMenu.label`: "Account" / "الحساب"
   - `home.userMenu.trigger`: "Account menu for {name}" / "قائمة الحساب الخاصة بـ {name}"
   - `notifications.navUnread`: "Notifications, {count} unread" / "الإشعارات، {count} غير مقروءة"
6. **320px budget:** `px-4 sm:px-6`, with hamburger 32 + brand (elastic) + avatar trigger about 40, so it fits by construction. At `sm`+ the nav is `min-w-0 flex-1 flex-wrap`.

---

## Context — Read These Files First

1. `apps/portal/src/components/portal/portal-header.tsx` and `portal-header.spec.tsx` (both in full).
2. `apps/web/src/components/workspace/workspace-header.tsx`, the Story 195 pattern.
3. `apps/portal/messages/{en,ar}.json`: `home.*`, `notifications.*`, `common.appName`.

---

## Tasks

1. **Messages** (design decision 5).
2. **Rewrite the header JSX.** Keep the handlers, `buildLocalePath`, `BrandScope`, the realtime banner and `navItems` (plus Home; the Notifications link name).
3. **Specs (intentional moves):**
   - `openUserMenu()` for the name, sign-out and language cases;
   - the Story 82 cases assert the brand link instead of "signedInAs";
   - the badge cases assert the link's name and an `aria-hidden` badge.
   - New cases:
     - Home is the first nav item, and is current on `/home`;
     - the brand link → `/home`, with `truncate` and `focus-ring`;
     - the logo cap;
     - the user menu holds language, theme and sign-out;
     - Escape restores focus;
     - the hamburger is in the header row;
     - logical classes only.

---

## Verification Steps

1. Portal tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Portal build; Playwright `customer-submits-ticket.spec.ts`.
3. Harness at 320 and 1280 × en/ar × light/dark:
   - 0 overflow with the menu closed and open;
   - the menu holds 2 selects and sign-out;
   - Escape restores focus;
   - the brand link → home;
   - nav hrefs include Home.
4. Run `git diff --check`, commit path-scoped, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] One-row header with brand, nav (+ Home) and user menu; the hamburger in the row below `sm`.
- [ ] Brand truncates, has a focus ring, and the logo is capped.
- [ ] Language, theme and sign-out in the menu with unchanged behaviour.
- [ ] Unread count in the Notifications link name; badge `aria-hidden`.
- [ ] 0 overflow at 320 in en/ar; specs, build and Playwright green.
