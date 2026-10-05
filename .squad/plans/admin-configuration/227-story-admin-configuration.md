# Story 227 — Admin II: configuration

> CRM product redesign roadmap item **PR-4.6**. Intake: [`../../stories/admin-configuration/admin-configuration/intake.md`](../../stories/admin-configuration/admin-configuration/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 4.

## Prerequisites

Stories 211, 225.

## Story Goal

One vocabulary across the nine configuration screens.

**Non-goals:** edit Sheets for every row; new settings.

## Design decisions

1. **ActiveBadge** (`@crm/ui`) — Badge in success / secondary with a decorative dot and the word; replaces the hand-written active/inactive badges in all nine screens (same copy keys).
2. **CreateDialog** (web) — a "New …" header button (the form's own `createHeading`) opening a Dialog with the existing form; `useCreateDialogClose()` closes it on success for automation rules and quick replies; API keys and webhooks stay open so the one-time secret stays visible. Single-field adds (categories, departments) stay inline beside their list.
3. **QueryStateCard** — SLA policies, automation rules, webhooks and API keys: the same skeleton rows, error title + retry, empty state (with its action) and table.
4. **h1** — every screen already renders its PageHeader in all states (audited).

## Tasks

1. ActiveBadge (+ spec, export), CreateDialog, the nine views.
2. Specs: create-form tests in four specs open the dialog first (`openCreateDialog()`), reason recorded.

## Verification Steps

1. web/ui vitest, typecheck, lint, build; Playwright full suite.
2. Harness: nine screens at 390/1280 × en light / ar dark (one h1, no overflow, dialogs open).

## Done Criteria

- [ ] Badge, dialogs, state card; payloads unchanged; suites green.
