# Story 226 — Admin I: people and access

> CRM product redesign roadmap item **PR-4.5**. Intake: [`../../stories/admin-people-access/admin-people-access/intake.md`](../../stories/admin-people-access/admin-people-access/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 4.

## Prerequisites

Stories 211 (Sheet), 225 (FormSection, FormField use).

## Story Goal

Users and roles as readable lists with Sheet editors; same requests.

**Non-goals:** new fields or permissions.

## Design decisions

1. **Users row** — the same five column headers: email (LTR), avatar (presence dot) + name, role name + department name (or "No department"), Active/Inactive (+ Locked) badges, presence badge; an actions cell with "Edit" (accessible name "Edit {name}").
2. **Users Sheet** — "Edit {name}": sections Details (email, full name — blur commit as before), Role and department (the two Selects, hints/errors as field hints), Reset password (field + destructive trigger + ConfirmDialog, success/error lines), Account status (badge, Activate/Deactivate with its ConfirmDialog, Locked + Unlock). The same state, handlers and mutations, moved.
3. **Users toolbar** — `ListToolbar` (same blur/Enter search) with a polite count.
4. **Roles** — the expanded table row becomes a `Sheet` controlled by the existing `expanded` state: "Permissions for {role}", one `fieldset` per resource (key prefix, sorted), mono checkbox labels, the permissions error inside, and a footer "Hide permissions" close.
5. **Mobile-label guard** — roles now has one exempt cell (actions), users gains its actions cell.

## Tasks

1. Views; messages en/ar; guard allowlist.
2. Specs: users tests that use editing controls open the editor first (`openEditor()`), five error assertions and two badge checks scope to the Sheet (the row and Sheet both show the badge; the shared update error shows once); roles collapse test scopes to the Sheet — reasons recorded; new row/Edit test.

## Verification Steps

1. web vitest, typecheck, lint, build; Playwright full suite.
2. Harness: users + user Sheet, roles + permissions Sheet at 390/1280 × en light / ar dark (demo admin).

## Done Criteria

- [ ] Sheets with every control; same payloads; suites green.
