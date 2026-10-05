# Story 224 — Notifications, account and settings

> CRM product redesign roadmap item **PR-4.3** (RD-4.8 + RD-6.5). Intake: [`../../stories/account-and-settings/account-and-settings/intake.md`](../../stories/account-and-settings/account-and-settings/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 4.

## Prerequisites

Story 198 (hosted views / heading levels).

## Story Goal

A notifications inbox that leads with history, one Account area, and linkable settings tabs.

**Non-goals:** read/unread backend; nav changes for admin screens.

## Design decisions

1. **Notifications** — `NotificationPreferencesSection` moves after the history and its pagination; the event renders as medium-weight text; the extra `overflow-x-auto` wrapper goes (the Table has its own).
2. **Account** — `AccountView` (h1 "Account"): a Profile section (decorative Avatar + DescriptionList: name, email `dir="ltr"`, roles badges) from `/auth/me`, then `MySessionsView hosted` (PageHeader `headingLevel={2}`) and `ChangePasswordSection`. Sessions show "Chrome · Windows" (full agent in the title; unknown agents unchanged) and an outline Sign out (its ConfirmDialog stays destructive). Route `/my-sessions` kept; nav label "My Account".
3. **Settings** — local `tab` state seeded from `?tab=` (validated) and re-synced when the URL changes; selecting a tab `router.replace`s the URL (`branding` = no param, `scroll: false`).
4. **Business hours** — `min-w-24` instead of `w-24` (longer Arabic day names).

## Tasks

1. Views and page; messages en/ar (`account` namespace, nav label).
2. Specs: account view, settings deep link, notifications order, device naming; Playwright nav label updated (reason recorded).

## Verification Steps

1. web vitest, typecheck, lint, build; Playwright full suite.
2. Harness: account, settings?tab=businessHours, notifications at 390/1280 × en/ar × light/dark (demo admin).

## Done Criteria

- [ ] RD-4.8 / RD-6.5 scope; same saves; suites green.
