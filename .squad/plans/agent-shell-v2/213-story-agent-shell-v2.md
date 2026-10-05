# Story 213 — Agent shell v2

> CRM product redesign roadmap item **PR-2.1**. Intake: [`../../stories/agent-shell-v2/agent-shell-v2/intake.md`](../../stories/agent-shell-v2/agent-shell-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 2; direction §3, §6; decision PD-10.

## Prerequisites

Stories 210 (chrome tokens, `.on-chrome`, recipes), 211 (Sheet), 212 (chrome Button).

## Story Goal

The ink chrome frames the canvas in both layouts; navigation is regrouped by intent; phones get a drawer.

**Non-goals:** permission-gated nav; new routes; login; portal.

## Design decisions

1. **Header** — `recipes.chrome` + `border-b-2 border-brand` (Tier 1 edge kept); brand text `text-chrome-ink`; bell, user-menu trigger and hamburger `variant="chrome"`; New ticket stays the accent fill. The user Popover opens on the light raised surface (unchanged content).
2. **Rail** — `recipes.chrome`, `border-e border-chrome-rule`; `RailNav` (exported) renders the grouped links; headings `text-label text-chrome-muted`; items via `chromeNavItemClassName(isActive)`: active `border-brand bg-chrome-active font-medium text-chrome-ink`, rest `text-chrome-muted hover:bg-chrome-raised hover:text-chrome-ink`. Collapse behaviour, tooltips and storage key unchanged.
3. **Navbar row** — `recipes.chrome` band with `border-chrome-rule`; group triggers use the same chrome item treatment; menus stay on the light surface.
4. **Drawer** — below `sm`, the hamburger is a `SheetTrigger`; `SheetContent side="start" size="sm"` on the chrome, titled "Menu" (`nav.menuLabel`), close `nav.closeMenu`, holding `RailNav`; it closes on link click and on route change.
5. **PD-10** — `NAV_GROUPS`: work (dashboard, tickets, customers, knowledge-base, notifications) · insights (reports, audit-logs) · configure (sla-policies, ticket-categories, kb-categories, automation-rules, quick-replies, notification-templates) · admin (branches, users, roles, webhook-subscriptions, api-keys) · account (settings, my-sessions). Group names en/ar replaced; `nav.closeMenu` added.

## Tasks

1. The four components; messages.
2. Specs: group keys/links (PD-10), chrome classes, drawer (dialog of links) — each with a recorded reason; new cases (chrome band, rail, drawer open/close).
3. Playwright admin-navigation-layout: group menu names.

## Verification Steps

1. web tests, typecheck, lint, prettier (only files clean at HEAD; two specs that were not clean at HEAD keep their original formatting).
2. Web build; harness; Playwright admin-navigation-layout, agent-resolves-ticket, session-expiry.
3. Protected checksum; path-scoped commit.

## Done Criteria

- [ ] Chrome header + rail + navbar; drawer on phones; regrouped nav.
- [ ] Suites, build, harness and Playwright green.
