# Story 33 — Agent Workspace: Business Hours Calendar Management

## Prerequisites

- `sla-policy-foundation` Story 12 completed: `BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException` models, `BusinessHoursCalendarsController` (full CRUD), `sla:create`/`sla:read`/`sla:update` permissions. Never previously consumed by any frontend.

---

## Story Goal

Give the Agent Workspace a real business-hours calendar screen — create-if-none, edit-weekly-schedule, manage-exceptions — over the already-complete `BusinessHoursCalendarsController`, as an entirely new, independent route/component surface.

**Not in scope**: SLA policy configuration (Story 31, unmodified), any change to SLA target computation, calendar/exception deletion (no endpoint), any new backend endpoint/DTO/permission/model/migration.

---

## Context — Read These Files First

1. `apps/api/src/modules/sla-policies/business-hours-calendars.controller.ts` and `.service.ts`, plus all four DTOs (`business-hours-day.dto.ts`, `create-business-hours-calendar.dto.ts`, `update-business-hours-calendar.dto.ts`, `create-business-hours-exception.dto.ts`, `update-business-hours-exception.dto.ts`) — confirmed this planning pass, full shapes and cross-field rules captured in the intake's Technical hints.
2. `apps/web/src/components/sla-policies/sla-policy-list-view.tsx` (Story 31) — the closest precedent: dedicated API/hooks files, `SlaPolicyRow`-style per-item subcomponent for exceptions, blur-commit-with-revert-on-error pattern, `actionForbidden`/`actionFailed` distinction.
3. `apps/web/src/components/customers/customer-detail-view.tsx` (Story 30/27) — the 404-vs-generic-error distinction (`customerQuery.error instanceof ApiError && ...status === 404`) this story reuses for "no calendar yet."

---

## Design (resolved during this planning pass)

1. **One page, two states**: `GET /business-hours-calendars` 404 (no calendar exists for this branch yet) renders a create form; any other outcome renders the weekly editor + exceptions section. No separate `/business-hours/new` route — a branch has at most one calendar, so there is nothing to disambiguate by id (mirroring the backend's own "no `:id` for the calendar itself" convention).
2. **Whole-array save for the weekly schedule, not per-field blur-commit** (see intake's own Design decision) — one "Save schedule" button submitting the complete 7-entry draft via `PATCH /business-hours-calendars`.
3. **Exceptions use the established per-row-mutation-hook pattern** (`ExceptionRow`, mirroring `ContactRow`/`SlaPolicyRow`/`UnclaimedTicketRow`) since each exception has its own id and its own `PATCH .../exceptions/:exceptionId`.
4. **Exceptions are read from the calendar's own already-embedded `exceptions` array** — no second `GET /business-hours-calendars/exceptions` request, mirroring Story 26's embedded-contacts precedent.
5. **Time representation**: `<input type="time">` in the UI, converted to/from minutes-since-midnight at the form boundary only (`HH:MM` ↔ integer) — presentation-only conversion, no new business rule.
6. **Create-form default**: Mon-Fri 09:00-17:00 open, Sat/Sun closed, pre-filled but fully editable and never auto-submitted — a UX starting point, not an invented business rule (the agent must explicitly submit).
7. **Dedicated new files**, zero overlap with Story 34 or any existing screen.

---

## Implementation Tasks

### 1 — API client

File: `apps/web/src/lib/business-hours-api.ts` (new)

- Types mirroring the backend exactly: `BusinessHoursDay { weekday, isOpen, startMinute: number | null, endMinute: number | null }`, `BusinessHoursException { id, date, isClosed, overrideStartMinute: number | null, overrideEndMinute: number | null }`, `BusinessHoursCalendar { id, days: BusinessHoursDay[], exceptions: BusinessHoursException[] }`.
- `getBusinessHoursCalendar()`, `createBusinessHoursCalendar(input)`, `updateBusinessHoursCalendar(input)`, `createBusinessHoursException(input)`, `updateBusinessHoursException(exceptionId, input)`.

### 2 — Hooks

File: `apps/web/src/hooks/use-business-hours.ts` (new)

- `useBusinessHoursCalendarQuery()`, `useCreateBusinessHoursCalendarMutation()`, `useUpdateBusinessHoursCalendarMutation()`, `useCreateBusinessHoursExceptionMutation()`, `useUpdateBusinessHoursExceptionMutation(exceptionId)` — never-optimistic, invalidating `["business-hours-calendar"]` on success.

### 3 — View + route

- `apps/web/src/components/business-hours/business-hours-view.tsx` (new): loading/404-create-form/generic-error/populated states.
- `apps/web/src/components/business-hours/create-business-hours-calendar-form.tsx` (new, or inline in the same file): the 7-row pre-filled create form.
- `apps/web/src/app/[locale]/(agent)/business-hours/page.tsx` (new).

### 4 — i18n

New top-level `businessHours.*` namespace in `apps/web/messages/{en,ar}.json`.

### 5 — Tests

New `business-hours-view.spec.tsx` mirroring `sla-policy-list-view.spec.tsx`'s conventions.

---

## Edge Cases & Failure Modes

- **No calendar exists** (404): create form, not an error.
- **A day is toggled closed after having times set**: times are cleared client-side before the next save (mirrors the DTO's own "closed ⇒ no minutes" rule, applied as a UX affordance, not a new validation the client silently invents beyond what the server already requires).
- **Save is rejected** (e.g., a race where another agent already created a calendar): the real error message renders inline; the draft is preserved for correction, not discarded.
- **Adding/editing an exception is rejected**: same never-optimistic, inline-error handling as every other mutation in this codebase.

---

## Test Plan

1. Component tests as listed in Task 5.
2. Regression: full existing `apps/web` suite remains green (new files only). `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert (delete the new files/route).

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`; workspace-wide `pnpm typecheck`/`lint`. Build only if no shared dev-server contention exists at verification time.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real `GET`, `POST`, `PATCH /business-hours-calendars` and its `exceptions` sub-resource against real seeded data, re-fetched to confirm persistence.
4. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every other existing `apps/web` file have empty diffs.
5. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] `/business-hours` shows a create form when no calendar exists, and the real weekly schedule + exceptions when one does.
- [ ] The weekly schedule saves via the real `PATCH /business-hours-calendars`.
- [ ] Exceptions can be added and edited via the real endpoints.
- [ ] No mutation is ever applied optimistically.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- [ ] No existing `apps/web` file is modified — this story only adds new files.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Typecheck/lint clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
