# Story 83 — Automation Rules — Category & Department Actions

## Prerequisites

- Story 57 (`sla-automation-rules`): `AutomationRule` model,
  `AutomationRulesService`/`Controller` (CRUD), `AutomationEvaluationListener`
  (matches on `ticket.created`, emits `automation.rule_matched`),
  `AutomationActionListener` (applies the match, currently only
  `assignedToUserId`).
- Story 16 (`ticket-recategorization-sla-target-recomputation`):
  `TICKET_RECATEGORIZED_EVENT` and `SlaTargetListener.onTicketRecategorized`
  — re-derives a ticket's `SlaTicketTarget` from its current
  `category`/`priority`/`departmentId`, regardless of what caused the
  change. Reused verbatim; zero changes to this listener.

All prerequisites are complete; the story is fully unblocked.

---

## Story Goal

Story 57 shipped `AutomationRule` with exactly one action
(`actionAssignToUserId`) and explicitly deferred a wider action set,
citing an unresolved SLA-desync risk. That risk is already resolved by
existing machinery this story reuses. Adds two new, independently
optional actions to an `AutomationRule`:

1. `actionSetCategory` — sets `Ticket.category` when the matched ticket's
   own `category` is still `null`.
2. `actionSetDepartmentId` — sets `Ticket.departmentId` the same way,
   validated in-branch at rule create/update time (mirrors
   `actionAssignToUserId`'s own `requireUserInScope`).

When either action actually changes the ticket, `AutomationActionListener`
emits `TICKET_RECATEGORIZED_EVENT` (alongside the existing
`TICKET_UPDATED_EVENT`) so `SlaTargetListener` recomputes the SLA target
exactly as it already does for a human `PATCH /tickets/:id` — no new
SLA-domain code.

**Not in scope (deliberately deferred, not guessed):** a `priority`
action — `Ticket.priority` is non-nullable
(`@default(MEDIUM)`), so there is no way to distinguish "explicitly
chosen" from "defaulted," which the existing never-override-an-explicit-
choice guard requires to be safe. Left for a separate future story that
makes an explicit schema decision about `priority`'s nullability. Also
out of scope: multiple simultaneous matching rules, any change to
`AutomationEvaluationListener`'s matching/ordering logic (Design
decisions 2/4 from Story 57, untouched), and any change to
`SlaTargetListener` itself.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `AutomationRule` (lines ~537–552,
   the model gaining two new nullable fields + one new relation) and
   `Department` (lines ~63–77, gaining the matching back-relation array).
2. `apps/api/src/modules/sla-policies/automation-rules.service.ts` (whole
   file) — `createAutomationRule`/`updateAutomationRule`'s exact
   `requireUserInScope`-then-write shape is mirrored for the new
   `actionSetDepartmentId` validation (`requireDepartmentInScope`, new).
3. `apps/api/src/modules/sla-policies/dto/{create,update}-automation-rule.dto.ts`
   — gaining two new optional fields each.
4. `apps/api/src/modules/sla-policies/automation.events.ts` —
   `AutomationRuleMatchedEvent` gains `setCategory`/`setDepartmentId`
   (both `string | null`, mirroring the rule's own stored shape).
5. `apps/api/src/modules/sla-policies/automation-evaluation.listener.ts`
   — `resolveMatchingRule`'s `select` and the emitted event both widen to
   carry the two new fields through; matching logic itself is unchanged.
6. `apps/api/src/modules/tickets/automation-action.listener.ts` (whole
   file, 56 lines) — the method being extended: still one `prisma.ticket.
   update()`, but now conditionally including `category`/`departmentId`
   in `data` (only when the ticket's own current value is `null`), and
   emitting `TICKET_RECATEGORIZED_EVENT` when either actually changed.
7. `apps/api/src/modules/tickets/tickets.service.ts` lines ~213–255
   (`updateTicket`) — the exact `isRecategorized` boolean +
   `TICKET_RECATEGORIZED_EVENT` emission shape this listener now mirrors;
   `toTicketSummary` (already imported by the listener) is reused
   unchanged.
8. `apps/api/src/modules/sla-policies/sla-target.listener.ts` lines
   ~95–120 (`onTicketRecategorized`) — read only to confirm it already
   re-derives fully from the ticket's *current* row (branchId,
   departmentId, category, priority) with no assumption about what
   triggered the event. Zero changes here.
9. `apps/web/src/lib/automation-rules-api.ts`,
   `apps/web/src/hooks/use-automation-rules.ts`,
   `apps/web/src/components/automation-rules/automation-rules-view.tsx`
   (whole file) — the create form and table row gaining two new optional
   fields; `useDepartmentsQuery` (already used elsewhere, e.g.
   `ticket-detail-view.tsx`) is the department picker's data source.

---

## Backend Tasks

### 1 — Schema

**File: `apps/api/prisma/schema.prisma`**

```prisma
model AutomationRule {
  id                    String      @id @default(uuid())
  branchId              String      @map("branch_id")
  branch                Branch      @relation(fields: [branchId], references: [id])
  name                  String
  isActive              Boolean     @default(true) @map("is_active")
  conditionCategory     String?     @map("condition_category")
  actionAssignToUserId  String      @map("action_assign_to_user_id")
  actionAssignToUser    User        @relation(fields: [actionAssignToUserId], references: [id])
  /// Story 83 — both nullable/independent: a rule may set neither, one,
  /// or both, alongside its always-required assignment action. Applied
  /// only when the matched ticket's own current value is still `null`
  /// (never overrides an explicit human choice) — mirrors
  /// `AutomationActionListener`'s existing `assignedToUserId` guard.
  actionSetCategory     String?     @map("action_set_category")
  actionSetDepartmentId String?     @map("action_set_department_id")
  actionSetDepartment   Department? @relation(fields: [actionSetDepartmentId], references: [id])
  createdAt             DateTime    @default(now()) @map("created_at")
  updatedAt             DateTime    @updatedAt @map("updated_at")

  @@index([branchId])
  @@map("automation_rules")
  @@schema("sla")
}
```

Add `Department.automationRules AutomationRule[]` back-relation (next to
`tickets`).

Generate the migration from `apps/api`:
`pnpm prisma migrate dev --name add_automation_rule_category_department_actions`.

### 2 — DTOs

**Files: `apps/api/src/modules/sla-policies/dto/{create,update}-automation-rule.dto.ts`**
— add, on both:

```ts
@ApiProperty({ required: false })
@IsOptional()
@IsString()
actionSetCategory?: string;

@ApiProperty({ required: false })
@IsOptional()
@IsUUID()
actionSetDepartmentId?: string;
```

### 3 — `AutomationRulesService`

**File: `apps/api/src/modules/sla-policies/automation-rules.service.ts`**

- `AutomationRuleSummary` gains `actionSetCategory: string | null` and
  `actionSetDepartmentId: string | null`.
- New private `requireDepartmentInScope(departmentId: string, branchId:
  string): Promise<void>` — mirrors `requireUserInScope`'s exact shape,
  querying `prisma.department.findFirst({ where: { id: departmentId,
  branchId } })`, throwing `NotFoundException` when absent.
- `createAutomationRule`: when `dto.actionSetDepartmentId !== undefined`,
  call `requireDepartmentInScope` before `create`; write
  `actionSetCategory`/`actionSetDepartmentId` into `data` (both `??
  null`, matching `conditionCategory`'s own existing convention).
- `updateAutomationRule`: same `requireDepartmentInScope` guard when the
  field is present in the DTO; same conditional-spread `data` shape as
  every other optional field already uses.
- `toAutomationRuleSummary` maps both new fields through.

### 4 — `AutomationRuleMatchedEvent` + evaluation listener

**File: `apps/api/src/modules/sla-policies/automation.events.ts`**:

```ts
export interface AutomationRuleMatchedEvent {
  ticketId: string;
  ruleId: string;
  assignToUserId: string;
  setCategory: string | null;
  setDepartmentId: string | null;
}
```

**File: `apps/api/src/modules/sla-policies/automation-evaluation.listener.ts`**
— `resolveMatchingRule`'s `select` gains `actionSetCategory: true,
actionSetDepartmentId: true`; the emitted event includes both
(`matchedRule.actionSetCategory`, `matchedRule.actionSetDepartmentId`).
Matching/ordering logic itself (Design decisions 2/4) is unchanged.

### 5 — `AutomationActionListener`

**File: `apps/api/src/modules/tickets/automation-action.listener.ts`**

```ts
@OnEvent(AUTOMATION_RULE_MATCHED_EVENT)
async onAutomationRuleMatched(event: AutomationRuleMatchedEvent): Promise<void> {
  try {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: event.ticketId } });
    if (!ticket) {
      return;
    }

    const data: Prisma.TicketUpdateInput = {};
    if (!ticket.assignedToUserId) {
      data.assignedToUser = { connect: { id: event.assignToUserId } };
    }
    if (event.setCategory && !ticket.category) {
      data.category = event.setCategory;
    }
    if (event.setDepartmentId && !ticket.departmentId) {
      data.department = { connect: { id: event.setDepartmentId } };
    }
    if (Object.keys(data).length === 0) {
      // Every eligible field was already set by the time this event was
      // processed (e.g. an agent claimed/categorized it in the meantime,
      // or a second matched event for the same ticket) — never overwrite.
      return;
    }

    const wasRecategorized = data.category !== undefined || data.department !== undefined;

    const updated = await this.prisma.ticket.update({ where: { id: event.ticketId }, data });
    const summary = toTicketSummary(updated);

    this.eventEmitter.emit(TICKET_UPDATED_EVENT, {
      ticket: summary,
      actorUserId: null,
    } satisfies TicketUpdatedEvent);
    if (wasRecategorized) {
      this.eventEmitter.emit(TICKET_RECATEGORIZED_EVENT, {
        ticket: summary,
        actorUserId: null,
      } satisfies TicketRecategorizedEvent);
    }
  } catch (error) {
    this.logger.error(
      "Failed to apply automation rule actions for automation.rule_matched",
      error as Error,
    );
  }
}
```

(Using Prisma's own relation-`connect` syntax rather than raw scalar
foreign-key fields, since `data` is now built incrementally and typed as
`Prisma.TicketUpdateInput` — `assignedToUser`/`department` `connect`
compiles to the identical `assigned_to_user_id`/`department_id` column
write as the scalar form used elsewhere in this codebase; consistent
with how a partial, conditionally-built update object is otherwise
awkward to express with plain scalar keys in TypeScript.)

Import `Prisma` type from `@prisma/client`, `TICKET_RECATEGORIZED_EVENT`/
`TicketRecategorizedEvent` from `./tickets.events` (already importing
`TICKET_UPDATED_EVENT` from the same file).

---

## Edge Cases & Failure Modes

- **A ticket created with an explicit `category`/`departmentId` already
  set** (Story 43's own creation-time fields): the automation action for
  that specific field is skipped — mirrors the existing
  `assignedToUserId` guard exactly; never overrides an explicit human
  choice.
- **A rule with only the always-required assignment action** (every
  existing Story 57 rule): `actionSetCategory`/`actionSetDepartmentId`
  are `null`, both new `if` guards are false, behavior is byte-for-byte
  identical to before this story.
- **Every eligible field already set by processing time** (e.g. a second
  `automation.rule_matched` for the same ticket, or a human beat the
  automation to it): `data` stays empty, the listener returns without
  writing or emitting anything — mirrors the existing single-field
  guard's own early-return, generalized.
- **Only `assignedToUserId` changes, `category`/`departmentId` do not**:
  `TICKET_UPDATED_EVENT` fires (unchanged), `TICKET_RECATEGORIZED_EVENT`
  does not — `SlaTargetListener` is correctly never invoked for a change
  that cannot affect SLA-policy matching.
- **`actionSetCategory`/`actionSetDepartmentId` change the ticket**:
  `TICKET_RECATEGORIZED_EVENT` fires, `SlaTargetListener.
  onTicketRecategorized` re-derives the SLA target from the ticket's now-
  current `category`/`priority`/`departmentId` — the exact mechanism a
  human `PATCH` already exercises, with zero new code in that listener.
- **An `actionSetDepartmentId` naming a department outside the rule's own
  branch**: rejected at rule create/update time (`requireDepartmentInScope`,
  404) — the value stored is always already valid, so the listener never
  re-validates it at match time (mirrors `actionAssignToUserId`'s own
  trust-at-match-time convention).

---

## Test Plan

1. **`apps/api/src/modules/sla-policies/automation-rules.service.spec.ts`**
   — new cases: `createAutomationRule`/`updateAutomationRule` validate
   `actionSetDepartmentId` in-branch (404 when absent), persist both new
   fields, and `toAutomationRuleSummary` maps them through.
2. **`apps/api/src/modules/sla-policies/automation-evaluation.listener.spec.ts`**
   — update the matched-rule mock/assertion to include
   `setCategory`/`setDepartmentId` in the emitted event.
3. **`apps/api/src/modules/tickets/automation-action.listener.spec.ts`**
   — new cases: applies `category` when the ticket's own is `null`
   (and emits `TICKET_RECATEGORIZED_EVENT`); applies `departmentId` the
   same way; skips a field the ticket already has set; skips entirely
   (no write, no emit) when every eligible field is already set; a
   match with only `assignToUserId` set on the rule behaves exactly as
   before (regression case, using the existing test's own fixture).
4. **`apps/api/test/sla-automation-rules.e2e-spec.ts`** (or wherever
   Story 57's own e2e suite lives — confirm the actual filename) — new
   cases: creating a rule with `actionSetDepartmentId` outside the
   caller's branch 404s; a ticket created with no category, matching a
   rule with `actionSetCategory` set, ends up with that category and a
   recomputed (or newly-created) `SlaTicketTarget` if a matching
   `SlaPolicy` exists for it.
5. **`apps/web/src/components/automation-rules/automation-rules-view.spec.tsx`**
   — new cases: the create form includes optional category/department
   fields; submitting includes them only when filled in; the table row
   displays the resolved department name (via the already-fetched
   `useDepartmentsQuery()`, mirroring `userNameById`'s own resolution
   convention) when set.

---

## Migration / Rollback

- Purely additive: two new nullable columns + one new index-free FK
  relation on `AutomationRule`. No existing column altered or dropped.
- **Rollback:** drop the two columns. Every existing rule (which never
  set them) is unaffected; any rule that *did* set them reverts to
  assignment-only behavior — acceptable, matches this table's own
  existing "advisory automation, not the ticket's source of truth"
  precedent.
- **Half-applied state:** safe — old code never reads/writes the new
  columns.

---

## Verification Steps

1. `pnpm prisma generate && pnpm --filter @crm/api typecheck`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or the isolated-file fallback
   Stories 79–82 documented, if the sandbox's Prisma consent gate blocks
   `migrate reset --force` again).
4. `pnpm --filter @crm/web typecheck && pnpm --filter @crm/web lint && pnpm --filter @crm/web test`
5. `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (confirms
   `apps/worker`/`apps/portal` and every other untouched package remain
   unaffected).

---

## Done Criteria

- [ ] `AutomationRule` has `actionSetCategory`/`actionSetDepartmentId`
      via a real Prisma migration; `Department.automationRules`
      back-relation added.
- [ ] Both new actions are validated in-branch at rule create/update
      time, never re-validated at match time.
- [ ] `AutomationActionListener` applies each eligible field only when
      the ticket's own current value is `null`, and emits
      `TICKET_RECATEGORIZED_EVENT` (alongside the existing
      `TICKET_UPDATED_EVENT`) exactly when `category`/`departmentId`
      actually changed — never when only `assignedToUserId` changed.
- [ ] `SlaTargetListener` itself is completely unchanged.
- [ ] Every existing rule (assignment-only) behaves byte-for-byte as
      before this story.
- [ ] `priority` is not touched anywhere in this story.
- [ ] The agent-facing automation rules page exposes both new optional
      fields.
- [ ] Every item in `## Test Plan` is added/updated and passing.
- [ ] Every command in `## Verification Steps` passes.
- [ ] Every pre-existing test suite remains green, unweakened.
