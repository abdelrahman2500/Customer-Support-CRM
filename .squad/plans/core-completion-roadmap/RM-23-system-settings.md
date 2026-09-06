# RM-23 — Consolidated System Settings Screen

**Priority:** P2 · **Complexity:** Small-Medium · **Blocked:** No · **Phase:** Parallel / unphased

## Goal

A single System Settings screen composing every branch-scoped configurable
that already exists (branding, AI feature toggles, business-hours
defaults) in one place — plus, as a small, explicitly-scoped addendum,
close the remainder of the unbounded-list tech debt Story 106 deliberately
left untouched.

## Why it exists

Core 10 (Security & Administration) names "System configuration"
explicitly. Configuration today is scattered across `BrandingConfig`,
`AiSettings`, and `BusinessHoursCalendar` — each independently
administered, no single admin surface. **Verified before proposing**:
`bounded-list-caps` (Story 106) capped `CustomersService.listCustomers` and
three `KnowledgeBaseService`/`NotificationsService` methods, and explicitly
did not touch Users, Roles, Automation Rules, Quick Replies, or SLA
Policies list endpoints — those remain genuinely unbounded today, a small,
real, still-open piece of tech debt.

## Dependencies

Existing `BrandingConfig`/`AiSettings`/`BusinessHoursCalendar` endpoints
(no new backend model needed for the composition half).

## Backend work

- No new model for the settings composition itself — this is a frontend
  composition story.
- Add a `take` cap (mirroring Story 105/106's exact, already-proven
  pattern: a fixed, documented cap, no pagination UI, narrowing via
  existing filters is the tool for "I need to see more") to: Users list,
  Roles list, Automation Rules list, Quick Replies list, SLA Policies list
  — five services, one cap constant each, no new endpoint.

## Frontend work

- A composed System Settings page in `apps/web`, pulling from the existing
  branding/AI-settings/business-hours-admin screens' own components (or
  their underlying hooks, re-laid-out on one page) rather than replacing
  those existing, working screens.

## Worker/realtime work

None.

## Schema/migration work

None.

## Tests

- `users.service.spec.ts` / `roles`-equivalent / `automation-rules.service.
  spec.ts` / `quick-replies.service.spec.ts` / `sla-policies.service.spec.ts`
  — extend each with a "cap is applied" case, mirroring Story 106's own
  test shape exactly.
- New composed-settings-page component test.

## Acceptance criteria

- An admin can view and edit branding, AI feature toggles, and
  business-hours defaults from one screen without navigating between
  separate admin pages.
- The five previously-unbounded list endpoints now return a bounded result
  set, matching Story 105/106's own precedent exactly.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
