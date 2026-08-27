> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/agent-workspace-business-hours-admin/agent-workspace-business-hours-admin/intake.md`

---

## Feature

- **Feature name (display):** Agent Workspace — Business Hours Calendar Management
- **Feature slug (folder under `plans/`):** `agent-workspace-business-hours-admin`

## Tracker (metadata only)

- **Tracker type:** `github` · **Work item id:** `` · **Status:** ``

---

## Title

```text
Agent Workspace — Business Hours Calendar Management
```

---

## Description

```text
SLA target computation has, since Story 11, been capable of consuming a branch's business-hours calendar (Story 12/13) — but nobody has ever been able to create or view one, because `BusinessHoursCalendarsController`'s full CRUD (one calendar's weekly schedule + an open-ended list of date exceptions) has had zero frontend consumer. Every branch's SLA targets have silently fallen back to plain wall-clock arithmetic because no calendar has ever existed.

This story adds a new, standalone screen: create a branch's weekly business-hours schedule (7 days, open/closed + start/end time when open) if none exists yet, edit it once it does, and manage date-specific exceptions (holidays, half-days) — all over the already-complete `BusinessHoursCalendarsController` contract. No new backend endpoint, DTO field, permission, or business rule.
```

---

## Acceptance criteria

```text
- A new `/business-hours` route shows the branch's business-hours calendar via the existing `GET /business-hours-calendars`.
- If no calendar exists yet (a real 404 from that endpoint), a create form is shown instead of an error — pre-filled with an editable, non-submitted default (Mon-Fri 09:00-17:00 open, Sat/Sun closed) — submitted via the existing `POST /business-hours-calendars`.
- Once a calendar exists, all 7 weekdays render with an open/closed toggle and, when open, start/end time inputs; saving submits the complete 7-entry array via the existing `PATCH /business-hours-calendars` (the backend replaces the whole array atomically — there is no per-day endpoint).
- The calendar's already-embedded `exceptions` array (no second request) renders as a list; each exception's closed/override-hours state is editable via the existing `PATCH /business-hours-calendars/exceptions/:exceptionId`.
- A new exception can be added via the existing `POST /business-hours-calendars/exceptions`.
- Every mutation is never optimistic; a rejected mutation distinguishes 403 from a generic failure and leaves the prior state visible.
- No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule is introduced.
- No protected file, no `SlaPolicyListView`/`CreateSlaPolicyView`/`UserListView`/any ticket/customer/dashboard file is modified.
- English and Arabic translations exist for every new string under a new, dedicated `businessHours.*` namespace; RTL rendering is preserved.
- Component tests cover: 404-triggers-create-form, create submit, weekly schedule edit + save, exceptions list/add/edit, and 403/generic-failure states.
- Typecheck, lint, and build remain clean; existing suites remain unaffected.
```

---

## Dependencies

- **Blocked by:** `sla-policy-foundation` Story 12 (`BusinessHoursCalendarsController`, `BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException` models — never consumed by any frontend).
- **Depends on code areas:** none inside `apps/web` — brand-new files. `apps/api/src/modules/sla-policies/business-hours-calendars.*` is a read-only dependency, not modified.

## Extra notes

- Selected as part of an approved two-story parallel batch (Stories 33/34), independent of each other.
- **Zero file overlap with Story 34**: dedicated new `apps/web/src/lib/business-hours-api.ts`, `apps/web/src/hooks/use-business-hours.ts`, `apps/web/src/components/business-hours/*`, route `(agent)/business-hours`, `businessHours.*` i18n namespace — none shared with Story 34's `roles.*`/`roles/*` files.
- **Design decision — whole-array save, not per-field blur-commit**: `PATCH /business-hours-calendars` replaces the entire 7-entry `days` array atomically and the backend rejects an internally-inconsistent partial state (e.g., a day marked open with no times). Auto-committing on every field's blur (this codebase's usual convention) would repeatedly resend a genuinely invalid in-progress array while an agent is still filling in a day. This story instead uses one explicit "Save schedule" button submitting the complete draft — a deliberate, disclosed adaptation of the existing convention to this resource's atomic, cross-validated shape, not a new pattern invented without cause.
- **Design decision — no per-day mutation hook needed**: unlike `ContactRow`/`SlaPolicyRow`/`UnclaimedTicketRow`, days have no individual id — one shared `useUpdateBusinessHoursCalendarMutation()` at the top of the component handles the single "Save schedule" action; no rules-of-hooks-in-a-loop concern arises for the days editor. Exceptions DO have individual ids, so `ExceptionRow` (one per exception, calling `useUpdateBusinessHoursExceptionMutation(exceptionId)` once per instance) follows the established per-row-hook precedent.
- **Design decision — a 404 from `GET /business-hours-calendars` is a valid, expected "no calendar yet" state**, not hidden or converted to `null` — distinguished from other errors exactly the way `CustomerDetailView`/`TicketDetailView` already distinguish a 404 from a generic failure, then routed to a create form instead of an error banner.

## Technical hints

- `BusinessHoursDayDto { weekday: 0-6, isOpen, startMinute?, endMinute? }` — minutes since midnight; `weekday` follows `Date#getUTCDay()` (0=Sunday). Cross-field rules (all 7 present, start<end when open, no minutes when closed) are enforced server-side in `BusinessHoursCalendarsService`, confirmed this planning pass.
- `CreateBusinessHoursExceptionDto`/`UpdateBusinessHoursExceptionDto`: `date` is `YYYY-MM-DD`; `isClosed` defaults `true`; override minutes are required together only when `isClosed` is `false`.
- `sla:create`/`sla:read`/`sla:update` permissions already gate every route here — the same permissions Story 31 already exercises; no new permission.

## Out of scope

- SLA policy configuration itself (Story 31, unmodified).
- Any change to SLA target computation logic (`SlaTargetListener` — confirmed by the service's own doc comment to remain wall-clock-only regardless of this story).
- Deleting a calendar or an exception (no `DELETE` endpoint exists for either).
- User/roles/permissions, Notification/Audit-log UI, any backend change.
