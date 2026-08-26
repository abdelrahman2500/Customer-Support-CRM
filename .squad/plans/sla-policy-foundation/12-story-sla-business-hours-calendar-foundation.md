# Story 12 — SLA Business-Hours Calendar Foundation

> Recorded after implementation and verification, per this story's explicit
> instructions — mirrors the same document shape used for Stories 10–11.

## Prerequisites

- `sla-policy-foundation` Stories 10–11 completed (see [10-story-sla-policy-foundation.md](./10-story-sla-policy-foundation.md), [11-story-sla-target-computation.md](./11-story-sla-target-computation.md), implemented and committed as `b0bc708`/`572cae5`): the real `SlaPolicy`/`SlaTicketTarget` models and the `sla` Postgres schema this story adds to.
- `Branch.timezone` (`project-foundation` Story 02) — the timezone basis this calendar's minute-of-day values are meant to be interpreted against by a future story; unchanged and not duplicated onto the new model.
- This recon (`.squad`'s "Next-Story Recon Report" produced after Story 11) identified this as the only remaining SLA & Automation architecture item with no unmet cross-module or infrastructure prerequisite — everything else (`ticket.recategorized`, `sla-timers`, at-risk/breach, escalation, `AutomationRule`) is blocked behind either a Ticketing-side decision or BullMQ producer wiring that does not exist in `apps/api` at all.

---

## Settled decisions (binding for this story — confirmed by the user, not reopened)

1. **Calendar ownership:** one calendar per `Branch` (`BusinessHoursCalendar.branchId` is `@unique`). `Branch.timezone` is the timezone basis for interpreting minute-of-day values; it is **not** duplicated onto the calendar.
2. **Holiday modeling:** holidays/closures are exception rows (`BusinessHoursException`) belonging to the calendar — no separate generic Holiday model.
3. **Permissions:** reuses the existing `sla:create`/`sla:read`/`sla:update` — no new permission key.
4. **Roadmap:** continues the existing `sla-policy-foundation` feature slug as Story 12.
5. **Out of scope (unchanged from the prompt, all confirmed absent from the final diff):** any change to `SlaTargetListener` or business-hours-aware SLA target computation; recalculation of existing `SlaTicketTarget` rows; `ticket.updated`/`ticket.recategorized` handling; `sla-timers`/BullMQ/`sla.at_risk`/`sla.breached`/escalation/`AutomationRule`; Notifications/Socket.IO/realtime; any change under `apps/api/src/modules/tickets/**`; CASL; new permission keys; speculative generic scheduling abstractions.

---

## Story Goal

Introduce the persistence and CRUD foundation for a branch-scoped business-hours calendar — schema and API surface only, following the exact "foundation before behavior" shape `SlaPolicy` used in Story 10. `SlaTargetListener` (Story 11) is untouched and keeps computing targets via plain wall-clock arithmetic (`ticket.createdAt + policy.responseTargetMinutes` / `+ resolutionTargetMinutes`). A future story consumes this calendar.

---

## Design (why this shape, resolved from repository evidence)

- **Three models, not a generic scheduling framework:** `BusinessHoursCalendar` (one per Branch) → `BusinessHoursDay` (always exactly 7 rows, one per weekday) and `BusinessHoursException` (an open-ended list). No `BusinessHoursInterval` list-per-day table: no repository evidence names split-shift/multi-interval days anywhere, so a single open interval per day (`startMinute`/`endMinute`) is the smallest shape that satisfies the documented requirement (Story 12's own "avoid speculative generic scheduling abstractions").
- **Weekly hours:** `BusinessHoursDay.weekday` is a plain `Int` (0=Sunday..6=Saturday, matching JS `Date#getUTCDay()`/`Intl` conventions — see `docs/architecture/10-i18n-and-rtl.md`), `isOpen: Boolean`, nullable `startMinute`/`endMinute` (minutes since midnight, 0-1439). Both null when closed. Days are always replaced wholesale (delete+recreate in one transaction) on create/update — never managed as an individually-addressable list — because there are always exactly 7, never more or fewer.
- **Minutes, not `@db.Time`:** mirrors `SlaPolicy.responseTargetMinutes`'s own precedent (Story 10) of a plain integer over a specialized date/time subtype — simpler to validate, simpler to reason about, no new Prisma/Postgres time-type risk.
- **Exceptions:** `BusinessHoursException` is the one open-ended list here, so it is managed exactly like `customers.Contact` under `Customer` — create/list/update, no delete (this codebase has no DELETE endpoint anywhere: `Customer`, `Contact`, `Ticket`, `SlaPolicy` all omit it; this story follows that same universal precedent rather than introducing the first one). `date` uses `@db.Date` (the first `@db.*` mapping in this schema — chosen because this is a genuine calendar date, not a timestamp). `isClosed: true` (default) means fully closed that date; `isClosed: false` requires `overrideStartMinute`/`overrideEndMinute` (the normal weekday schedule is replaced for that date only).
- **Timezone:** obtained from `Branch.timezone` via the calendar's `branchId` relation — never duplicated onto `BusinessHoursCalendar` (explicit design requirement), and not consumed by anything in this story (no computation happens here at all).
- **Uniqueness:** `@@unique([branchId])` on the calendar (one per branch — create rejects a second with `409 Conflict`, mirroring `Contact`'s duplicate-email `P2002`→`ConflictException` translation exactly); `@@unique([calendarId, weekday])` on days; `@@unique([calendarId, date])` on exceptions.
- **Branch ownership:** enforced the same way every other branch-scoped resource in this codebase is — `TenantContext.requireBranchScope()` resolves the caller's own `branchId` server-side; it is never accepted as a request body/query field, so a caller cannot select another branch's calendar.
- **Delete behavior:** no DELETE endpoint anywhere in this story (see above) — an exception can be corrected via `PATCH`, and the weekly schedule is always managed wholesale via `PATCH`, so there is no scenario in this foundation that needs a real delete.
- **API surface — nested under branches, or its own route?** No `BranchesController`/`BranchesModule` exists anywhere in this codebase (Branch is seed-only) — nesting under a nonexistent `/branches` prefix would introduce a new top-level resource path with no sibling routes. Instead this follows `SlaPoliciesModule`'s own flat, schema-name-mirroring convention: a new top-level `/business-hours-calendars` resource, added to the *existing* `SlaPoliciesModule` (no new NestJS module), continuing the exact "grow this module per `sla`-schema concern" pattern Story 11 already used for `SlaTargets*`.
- **No `:id` on the calendar's own routes (a genuine, justified departure from every other resource's shape):** every other top-level resource (`Customer`, `Ticket`, `SlaPolicy`) is many-per-branch, so an `:id` is essential to disambiguate. `BusinessHoursCalendar` is a true 1:1-per-branch singleton — `TenantContext` alone already identifies at most one row, so requiring the caller to first look up an `:id` before they can ever read/update their own calendar would be a needless chicken-and-egg. Exceptions, by contrast, remain an open-ended list and keep an `:exceptionId` param, exactly like `Contact` keeps a `:contactId`.
- **Nested exception routes also omit a calendar `:id`** for the same reason (resolved via `TenantContext`, not a path param) — `POST/GET /business-hours-calendars/exceptions`, `PATCH /business-hours-calendars/exceptions/:exceptionId`.

---

## API Surface

| Method | Path | Permission |
| --- | --- | --- |
| `POST` | `/api/v1/business-hours-calendars` | `sla:create` |
| `GET` | `/api/v1/business-hours-calendars` | `sla:read` |
| `PATCH` | `/api/v1/business-hours-calendars` | `sla:update` |
| `POST` | `/api/v1/business-hours-calendars/exceptions` | `sla:create` (mirrors `Contact`'s reuse of `customer:create` for a new sub-entity row) |
| `GET` | `/api/v1/business-hours-calendars/exceptions` | `sla:read` |
| `PATCH` | `/api/v1/business-hours-calendars/exceptions/:exceptionId` | `sla:update` |

No new permission key. No DELETE route.

---

## Validation

- Per-field (DTO/`class-validator`): `weekday` 0-6, `startMinute`/`endMinute` 0-1439, `date` an ISO date string. First use of `@ValidateNested`/`@Type()` (nested-array validation) in this codebase — needed because `days` is a fixed 7-entry array; no simpler existing pattern covers this shape.
- Cross-field/cross-item (service layer, mirroring `CustomersService`'s duplicate-email-catch/`TicketsService`'s department-in-scope split between DTO and service validation):
  - Exactly 7 day entries; all 7 weekdays present exactly once.
  - An open day requires both `startMinute`/`endMinute`; a closed day must not carry either.
  - `startMinute < endMinute` strictly — **overnight intervals are explicitly not supported** in this foundation (no repository evidence requires them; deferred, not silently generalized).
  - An exception with `isClosed: false` requires both override minutes with the same `start < end` rule; `isClosed: true` must not carry override minutes. On update, the *merged* (existing + DTO) state is what's validated — switching to `isClosed: true` always clears any previously-set override minutes, never carries them forward.
  - Duplicate calendar per branch / duplicate exception date: enforced by the DB unique constraint, translated from Prisma's `P2002` into `409 Conflict`, matching `Contact`'s exact precedent — no application-level pre-check duplicating the DB's own source of truth.

---

## Implementation Summary

- **Schema (`apps/api/prisma/schema.prisma`):** `Branch.businessHoursCalendar BusinessHoursCalendar?` back-relation; new `sla`-schema models `BusinessHoursCalendar`, `BusinessHoursDay`, `BusinessHoursException` (see "Design" above for full field list and rationale). `onDelete: Cascade` on both children's `calendar` relation, mirroring `TicketHistoryEntry.ticket`'s existing explicit choice.
- **Migration:** `20260826131316_add_business_hours_calendars` — 3 new tables, 3 unique indexes (`branch_id`; `[calendar_id, weekday]`; `[calendar_id, date]`), FKs with `ON DELETE CASCADE` (children→calendar) and the implicit `ON DELETE RESTRICT` default (calendar→branch). No `ALTER TABLE` on any existing table.
- **New files (all under `apps/api/src/modules/sla-policies/`):** `dto/business-hours-day.dto.ts`, `dto/create-business-hours-calendar.dto.ts`, `dto/update-business-hours-calendar.dto.ts`, `dto/create-business-hours-exception.dto.ts`, `dto/update-business-hours-exception.dto.ts`, `business-hours-calendars.service.ts` (+ `.spec.ts`), `business-hours-calendars.controller.ts`.
- **`sla-policies.module.ts`:** extended (not replaced) with `BusinessHoursCalendarsController`/`BusinessHoursCalendarsService`, alongside the existing `SlaPolicies*`/`SlaTargets*`/`SlaTargetListener`.
- **`apps/api/test/business-hours-calendars.e2e-spec.ts` (new):** covers auth (401/403), create/get/update, duplicate-calendar rejection, invalid-schedule rejection, closure + override-hours exceptions, duplicate-exception-date rejection, exception update (including 404 for an unknown id). Tolerates re-running against the shared, persistent, never-reset seeded database by falling back from a 409 on calendar creation to resetting the existing one via `PATCH` — the calendar is a true per-branch singleton, unlike every other e2e-tested resource, so it cannot be re-created fresh every run.
- **No changes to:** `seed.ts` (no new permission key, no demo calendar data required), `app.module.ts` (module already registered), anything under `apps/api/src/modules/tickets/**`, `SlaTargetListener`, `.squad/config.yaml`.

---

## Edge Cases & Failure Modes

- Two calendars attempted for the same branch → `409` (unique constraint + `P2002` translation).
- An open weekday missing `startMinute`/`endMinute`, or a closed weekday carrying them → `400`.
- `startMinute >= endMinute` (including any attempt at an overnight interval) → `400` — explicitly deferred, not supported.
- Fewer/more than 7 day entries, or a duplicated weekday → `400`.
- An exception switching `isClosed: false → true` no longer carries stale override minutes forward from before the switch (validated against the merged final state, not the DTO in isolation) — this was caught and fixed during implementation (see Deviations).
- Two exceptions for the same calendar+date → `409`.
- Unknown/cross-calendar exception id on update → `404`.
- Unauthenticated → `401`; authenticated without the relevant `sla:*` permission → `403`.
- A ticket's SLA target continues to be computed by plain wall-clock arithmetic regardless of anything in this story — no interaction with `SlaTargetListener` exists yet.

---

## Verification (actual results)

| Step | Command | Result |
| --- | --- | --- |
| 1 | `pnpm --filter @crm/api prisma:validate` | ✅ Pass |
| 2 | `pnpm --filter @crm/api typecheck` | ✅ Pass |
| 3 | `pnpm --filter @crm/api lint` | ✅ Pass |
| 4 | `pnpm --filter @crm/api build` | ✅ Pass |
| 5 | `pnpm typecheck` (workspace) | ✅ Pass (6/6 tasks) |
| 6 | `pnpm lint` (workspace) | ✅ Pass (6/6 tasks) |
| 7 | `pnpm build` (workspace) | ✅ Pass (5/5 tasks) |
| 8 | `pnpm --filter @crm/api test` | ✅ 102/102 passed (9 files, incl. new `business-hours-calendars.service.spec.ts`) |
| 9 | Live migration (`prisma migrate dev --name add_business_hours_calendars`) | ✅ Applied; `migration.sql` inspected and matches design exactly |
| 10 | `pnpm --filter @crm/api prisma:seed` | ✅ Ran idempotently; `seed.ts` untouched |
| 11 | `pnpm --filter @crm/api test:e2e` | ✅ 68/68 passed (6 suites), run **twice** to confirm the singleton-calendar idempotent-rerun fallback works correctly on both a fresh-create and an already-exists path |
| 12 | Full regression (unit + e2e) | ✅ All prior suites (`sla-policies`, `sla-targets`, `tickets`, `customers`, `identity`) unaffected |
| 13 | `git status` | Clean except the intended new/modified files |
| 14 | `git diff --stat -- .squad/config.yaml` | Empty — untouched |
| 15 | `apps/api/src/modules/tickets/**` unchanged | ✅ `git diff --stat` empty |
| 16 | `SlaTargetListener` unchanged | ✅ Byte-for-byte identical to the `572cae5` commit (`diff` against `git show 572cae5:...`) |
| 17 | `gh run list --workflow=ci.yml --limit 5` | `gh` not reachable — **CI reported as pending, not verified** |

## Deviations from the plan

1. **Merge-then-validate bug found and fixed during implementation:** `updateException` initially carried an existing exception's override minutes forward even when the caller switched `isClosed` to `true`, causing the (now-closed) merged state to fail its own "closed cannot carry override minutes" check. Fixed so a final `isClosed: true` always discards override minutes regardless of what previously existed. Caught by a unit test before the e2e suite was even written.
2. **`prisma format` was run once** after the schema edit to normalize column alignment (Branch's field list) — a formatting-only, zero-semantic-change pass.

## Deferred decisions (explicitly out of scope, left for a future story)

- The exact business-hours-aware computation algorithm `SlaTargetListener` (or its successor) will use to consume this calendar.
- Whether/how `ticket.recategorized` or `ticket.updated` ever triggers recomputation.
- Whether exceptions ever need a delete capability (none exists in this codebase yet, for any resource).

---

## Done Criteria

- [x] `BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException` exist in the `sla` schema, one calendar per branch.
- [x] `Branch.timezone` is the timezone basis; not duplicated onto the calendar.
- [x] 6 permission-checked REST endpoints exist, reusing `sla:create`/`sla:read`/`sla:update` only.
- [x] No DELETE endpoint anywhere in this story.
- [x] `SlaTargetListener` and `apps/api/src/modules/tickets/**` are byte-for-byte unchanged.
- [x] Migration is additive-only.
- [x] `seed.ts` and `.squad/config.yaml` are untouched.
- [x] Unit + e2e coverage as specified; full existing suite passes with no regressions.
- [x] CI status honestly reported as pending (gh unavailable), never claimed as passing.
