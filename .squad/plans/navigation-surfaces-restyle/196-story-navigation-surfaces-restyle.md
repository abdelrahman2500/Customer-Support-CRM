# Story 196 — Navigation surfaces restyle

> CRM UI/UX redesign roadmap item **RD-2.2**. Intake: [`../../stories/navigation-surfaces-restyle/navigation-surfaces-restyle/intake.md`](../../stories/navigation-surfaces-restyle/navigation-surfaces-restyle/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 2 "RD-2.2". Design language: Tier 1 brand on the "active-nav indicator"; icons "20px navigation". Recon A11Y-11; QA-03.

---

## Prerequisites

- Story 183 (RD-1.6): `--brand` / `border-brand` is the Tier 1 decorative brand colour, never branch-overridden into text.
- Story 179 (RD-1.2): `rounded-control` and `text-label`.
- Story 195 (RD-2.1): the header, done.

---

## Story Goal

A presentation-only restyle of the two desktop navigation surfaces and the shared item label:

- **Active state:** a neutral `bg-surface-muted` fill plus the brand indicator (`border-s-2 border-brand`) plus `font-medium`, with `aria-current="page"` on links. It replaces the accent tint, so selection no longer shares the focus ring's hue family (QA-03).
- **Icons:** 20px in the sidebar rail. Dropdown-menu rows (the navbar menus and the hamburger) stay 16px as inline menu rows.
- **Rail group headings:** `text-label text-ink-subtle`, with no uppercase or tracking.
- **Shape:** `rounded-control` replaces `rounded-md`. The rail toggle becomes `variant="ghost" size="icon-sm"`.
- **A11Y-11 (navbar):** when the unread count is known and non-zero, the trigger of the group holding Notifications names it: "{group} menu, {count} unread". The visual badge becomes `aria-hidden`, so it isn't read twice.

**Non-goals:**
- IA, grouping, order, href, label or permission changes
- the active-route rule
- the header
- the portal

---

## Context — Read These Files First

1. `apps/web/src/components/workspace/workspace-navbar.tsx` (+ spec ~200–222, ~300).
2. `apps/web/src/components/workspace/workspace-sidebar.tsx` (+ spec ~165–176, ~325–352).
3. `apps/web/src/components/workspace/nav-items.tsx` `NavItemLabel` (+ spec ~140–155).
4. `apps/web/messages/{en,ar}.json` `workspace.nav.groupMenuLabel`.
5. `apps/e2e/tests/admin-navigation-layout.spec.ts`: locates items by href and the trigger by name "Workspace menu". The seeded admin's unread count could change that name, so verify.

---

## Tasks

1. **`nav-items.tsx`:**
   - the icon is `h-5 w-5` outside menus and `h-4 w-4` inside them (the `-ms-4 me-4` pull-in is unchanged);
   - the comment cites the design-language icon sizes.
2. **`workspace-navbar.tsx`:**
   - trigger classes: `rounded-control`, with active `border-brand bg-surface-muted font-medium text-ink-strong` and inactive unchanged;
   - the `aria-label` becomes `nav.groupMenuLabelUnread` when `groupUnreadCount > 0`;
   - the Badge gets `aria-hidden="true"` and drops its own `aria-label`.
3. **`workspace-sidebar.tsx`:**
   - link `rounded-control`, with the same active classes;
   - heading `text-label text-ink-subtle`;
   - the toggle is a `ghost`/`icon-sm` button.
4. **Messages:** `workspace.nav.groupMenuLabelUnread`:
   - en: "{group} menu, {count} unread"
   - ar: "قائمة {group}، {count} غير مقروءة"
5. **Specs (intentional changes):**
   - `border-accent` → `border-brand`, plus `bg-surface-muted` and not `bg-accent-surface`, in the navbar and sidebar specs;
   - new: the rail icon is `h-5`, a menu icon is `h-4`;
   - new: the rail heading is `text-label`;
   - new: the trigger name includes the count, and the badge is aria-hidden;
   - existing logical-class guards stay.

---

## Edge Cases & Failure Modes

- **Unknown or zero count:** the trigger name is unchanged ("{group} menu"). That keeps the Playwright admin-navigation lookup working when the seeded branch has no unread notifications. If the seeded admin does have unread notifications, that spec's `getByRole("button", { name: "Workspace menu" })` still matches, because Playwright name matching is substring by default.
- **Hover vs active:** both use `surface-muted`. The active item is distinguished by the reserved brand border (layout-neutral, since `border-s-2` already exists) and `font-medium`, never by colour alone.
- **Brand contrast:** Tier 1 is decorative by contract. The 2px bar is supplementary to `aria-current` and the weight.
- **Collapsed rail:** labels stay `sr-only`, so the accessible names are unchanged; the 20px icons centre in `w-16`.

---

## Verification Steps

1. Web tests, typecheck and lint; prettier only on the changed files.
2. Web build, then Playwright `admin-navigation-layout.spec.ts`.
3. Harness: navbar and sidebar (and collapsed) at 1280 × en/ar × light/dark:
   - the active computed background is `surface-muted`;
   - the active border colour is the brand colour;
   - icon size 20px in the rail;
   - collapsed tooltips on the content side.
4. Run `git diff --check`, review the diff, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] Neutral active state with the brand indicator in the navbar and rail.
- [ ] 20px rail icons, `text-label` headings, `rounded-control`, ghost toggle.
- [ ] Navbar trigger names carry the unread count; the badge is aria-hidden.
- [ ] Nav order, hrefs, labels and active rules unchanged; specs updated for the intentional changes; Playwright green.
- [ ] Web tests, typecheck, lint and build pass.
