# Story 10 — SLA Policy Foundation

## Prerequisites

- `project-foundation` Stories 01–05 completed: `TenantContext` (`apps/api/src/common/tenant/tenant-context.ts`), the globally-registered `AuthGuard`/`PermissionsGuard`/`AuditInterceptor` (`apps/api/src/app.module.ts`), and the seed/test conventions all exist exactly as built and are reused unchanged.
- `ticketing` Stories 07–09 completed (see [../ticketing/07-story-ticket-and-assignment-foundation.md](../ticketing/07-story-ticket-and-assignment-foundation.md), [08-story-ticketing-domain-events-foundation.md](../ticketing/08-story-ticketing-domain-events-foundation.md), [09-story-ticket-history-timeline.md](../ticketing/09-story-ticket-history-timeline.md)): the real `Department` scoping and `TicketPriority` enum this story's `SlaPolicy` scopes against.
- `customer-management` Story 06 completed (see [../customer-management/06-story-customer-and-contact-foundation.md](../customer-management/06-story-customer-and-contact-foundation.md)): the closest precedent for this story's exact shape — a branch-scoped aggregate root with permission-checked create/list/get/update, no delete, no pagination, no seed fixture data.
- This is the first story of the new `sla-policy-foundation` feature slug. Per the Story 10 Recon Report, Story 10 was selected as a human-confirmed roadmap decision, not a pre-existing definition — see this plan's own "Settled decisions" for exactly what was and wasn't decided.

---

## Settled decisions (binding for this story — do not re-open)

1. **Scope:** the `SlaPolicy` domain only — schema, model, and branch-scoped CRUD. No part of the runtime SLA automation lifecycle (target computation, business-hours calendar, `sla-timers` job, breach/at-risk detection, escalation, `AutomationRule`) is built here.
2. **No `ticket.created`/`ticket.updated` listener.** This story does not subscribe to any Ticketing event and does not touch `apps/api/src/modules/tickets/**` at all.
3. **No `ticket.recategorized` event is introduced.** The existing event contract (`TicketCreatedEvent`/`TicketUpdatedEvent`) is unchanged.
4. **No business-hours or holiday calendar model.** SLA targets are stored as plain integer minute counts (`responseTargetMinutes`, `resolutionTargetMinutes`) — business-hours-aware computation is explicitly a later story's concern.
5. **`SlaPolicy.priority` is a plain nullable `String`, not a Prisma enum**, even though it is validated at the DTO layer against the existing `TicketPriority` values (`LOW`/`MEDIUM`/`HIGH`/`URGENT`). This avoids a cross-Postgres-schema enum reference (the `TicketPriority` enum is declared `@@schema("ticketing")`; `SlaPolicy` lives in the new `sla` schema) — an unverified risk this story does not need to take. It mirrors the existing precedent of `Ticket.category` (also a plain nullable `String`, not a lookup table or enum).
6. **No uniqueness constraint across the scoping dimensions** (`branchId`, `departmentId`, `category`, `priority`). Multiple overlapping or ambiguous policies can be created; **which policy wins for a given ticket is a policy-resolution concern explicitly deferred** to whichever future story implements target computation. This story only stores policies, it does not decide how they are matched against a ticket.
7. **No new permission beyond `sla:create`, `sla:read`, `sla:update`.** No `sla:delete` (no delete endpoint — deactivation happens via `isActive` on update, mirroring `Customer.isActive`).
8. **No seed fixture `SlaPolicy` rows.** Only the three new permission keys are added to `apps/api/prisma/seed.ts`'s `PERMISSION_CATALOG`.
9. **No changes to `admin.audit_logs`, `AuditInterceptor`, CASL, BullMQ, Socket.IO, or `.squad/config.yaml`.**

---

## Story Goal

Give the platform a real `SlaPolicy` domain: a new `sla` Postgres schema with a branch-scoped `SlaPolicy` model and 4 permission-checked REST endpoints, following exactly the module/service/controller/test shape `CustomersModule` established in `customer-management` Story 06. `SlaPolicy` is a top-level aggregate root (like `Customer`/`Ticket`, not a sub-entity like `Contact`) — it carries its own `branchId` and is scoped by `TenantContext.requireBranchScope()` on every operation, with an optional `departmentId` (verified against the caller's branch, mirroring `TicketsService.requireDepartmentInScope`), and optional `category`/`priority` scoping dimensions mirroring the equivalent fields already on `Ticket`.

**Not in scope:** anything that *consumes* a policy. No ticket ever gets an SLA target computed by this story — that requires a future story to react to `ticket.created`/`ticket.updated`, which this story deliberately does not touch.

---

## Context — Read These Files First

1. [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — line 11, the `SLA & Automation` row: schema `sla`, owns "SLA policies, timers, escalation and automation rules," "Subscribes to ticketing events." This story builds only the first noun ("SLA policies"); everything else in that cell is out of scope.
2. [docs/architecture/07-sla-automation-and-ai.md](../../../docs/architecture/07-sla-automation-and-ai.md) — line 7, the only sentence in the architecture that describes `SlaPolicy`'s shape: "scoped by branch/department, category, and priority, and defines response/resolution targets and a business-hours calendar." This story implements the scoping dimensions and the targets (as plain minute counts); the business-hours calendar is explicitly deferred (Settled decision 4).
3. `apps/api/src/modules/customers/customers.service.ts` — whole file (197 lines), the exact shape to mirror: constructor-injected `PrismaService` + `TenantContext` (lines 33-38); `createCustomer` assigning `branchId` from `TenantContext`, never the DTO (lines 40-46); `listCustomers`/`getCustomer`/`updateCustomer` (48-72); the private `findCustomerInScope`/`requireCustomerInScope` helpers (134-154) and their "404 for out-of-scope, never 403" pattern.
4. `apps/api/src/modules/tickets/tickets.service.ts` — the `requireDepartmentInScope` method (verified present in this file from `ticketing` Story 07) — the exact pattern this story's own department-in-scope check mirrors, since `SlaPolicy.departmentId` is a cross-reference into `identity.departments`, the same shape `Ticket.departmentId` already has.
5. `apps/api/src/modules/customers/customers.controller.ts` — whole file (38 lines) — the controller shape (4 routes, `@RequirePermissions(...)`, no `@Public()`) to mirror exactly.
6. `apps/api/src/modules/customers/customers.module.ts` — whole file (19 lines) — the module shape (`TenantContext` provided locally) to mirror.
7. `apps/api/src/modules/customers/dto/create-customer.dto.ts` (9 lines) and `dto/update-customer.dto.ts` (15 lines) — the `class-validator`/`@ApiProperty` conventions (required vs. `@IsOptional()`).
8. `apps/api/prisma/schema.prisma` — the `Branch` model (needs a new `slaPolicies SlaPolicy[]` back-relation, the same schema-file-only pattern used for every back-relation added in Stories 06–09), the `Department` model (needs the same), the `Ticket`/`TicketHistoryEntry` models at the end of the file (where the new `sla` schema section is appended after), and the `datasource.schemas` array (currently `["identity", "admin", "customers", "ticketing"]`, gaining `"sla"`).
9. `apps/api/prisma/seed.ts` — lines 19-29 (`PERMISSION_CATALOG`, currently ending in `"ticket:create", "ticket:read", "ticket:update"`) and lines 32-35 (`ROLE_GRANTS`, `SuperAdmin: PERMISSION_CATALOG` / `Agent: []`) — exactly what Task 6 appends three keys to; `ROLE_GRANTS` needs no edit, per the established pattern.
10. `apps/api/src/app.module.ts` — whole file (48 lines) — lines 14-16 (module imports) and 31-33 (`imports` array) — where the new `SlaPoliciesModule` is registered alongside `IdentityModule`/`CustomersModule`/`TicketsModule`.
11. `apps/api/src/modules/customers/customers.service.spec.ts` (274 lines) and `apps/api/test/customers.e2e-spec.ts` — the hand-built-mock unit-test pattern and the real-`AppModule`/real-Postgres e2e bootstrap pattern this story's new tests copy, including the Agent-fixture-creation-via-API pattern for `403` tests (also present in `apps/api/test/tickets.e2e-spec.ts`, which additionally shows how to fetch a real, in-scope `departmentId` via `GET /api/v1/auth/me` rather than inventing a way to list departments — no such listing endpoint exists anywhere in this codebase).

---

## Product rules (from story)

- **Current:** no `sla` schema, no `SlaPolicy` model, no SLA-related permission keys. `PERMISSION_CATALOG` (`apps/api/prisma/seed.ts`) ends at `ticket:update`.
- **New:** a `sla` Postgres schema with a branch-scoped `SlaPolicy` model (departmentId/category/priority optional scoping dimensions, plain-minute response/resolution targets, `isActive`); 4 permission-checked REST endpoints; three new permission keys (`sla:create`, `sla:read`, `sla:update`) granted to `SuperAdmin` only via the existing `PERMISSION_CATALOG` reference — `Agent`'s grant stays `[]`, unchanged.

---

## Implementation Tasks

### 1 — Prisma schema

File: `apps/api/prisma/schema.prisma`

Update the `datasource` block's `schemas` array:

```prisma
  schemas    = ["identity", "admin", "customers", "ticketing", "sla"]
```

Add a back-relation field to the **existing** `Branch` model (schema-file-only, no column, no migration SQL — same pattern as every prior back-relation in this file):

```prisma
  slaPolicies    SlaPolicy[]
```

Add a back-relation field to the **existing** `Department` model:

```prisma
  slaPolicies SlaPolicy[]
```

Append a new section at the end of the file, after the `ticketing` schema's `TicketHistoryEntry` model:

```prisma
// ---------------------------------------------------------------------------
// sla schema
// ---------------------------------------------------------------------------

/// See docs/architecture/03-domain-boundaries.md ("SLA & Automation") and
/// docs/architecture/07-sla-automation-and-ai.md ("SlaPolicy is scoped by
/// branch/department, category, and priority, and defines response/
/// resolution targets and a business-hours calendar"). This story implements
/// only the scoping dimensions and plain-minute targets — no business-hours
/// calendar, no target computation, no consumption by Ticketing events (see
/// this plan's "Settled decisions"). `priority` is deliberately a plain
/// nullable String, not the `TicketPriority` enum (which lives in a
/// different Postgres schema) — mirrors `Ticket.category`'s own precedent.
/// No uniqueness constraint across the scoping dimensions — policy
/// resolution is a future story's concern, not this one's.
model SlaPolicy {
  id                       String    @id @default(uuid())
  branchId                 String    @map("branch_id")
  branch                   Branch    @relation(fields: [branchId], references: [id])
  departmentId             String?   @map("department_id")
  department               Department? @relation(fields: [departmentId], references: [id])
  category                 String?
  priority                 String?
  responseTargetMinutes    Int       @map("response_target_minutes")
  resolutionTargetMinutes  Int       @map("resolution_target_minutes")
  isActive                 Boolean   @default(true) @map("is_active")
  createdAt                DateTime  @default(now()) @map("created_at")
  updatedAt                DateTime  @updatedAt @map("updated_at")

  @@index([branchId])
  @@map("sla_policies")
  @@schema("sla")
}
```

Run `pnpm --filter @crm/api prisma:validate` after editing — must pass with no relation errors. This is also the point at which to confirm there is no cross-schema issue from `Department`/`Branch` (in `identity`) being referenced from a model in the new `sla` schema — the exact same cross-schema-FK pattern `Ticket`/`Customer`/`TicketHistoryEntry` already use successfully, so it is expected to validate cleanly.

### 2 — Migration

With Docker Postgres up (`docker compose up -d postgres redis`, using the documented temporary `5433:5432` port fallback if the native PostgreSQL 18 service is again occupying `5432` — revert both `docker-compose.yml` and `apps/api/.env` immediately after, exactly as Stories 06–09 did), run:

```bash
pnpm --filter @crm/api exec prisma migrate dev --name add_sla_policies
```

This must generate exactly one new migration containing `CREATE SCHEMA "sla"`, one `CREATE TABLE`, the `branch_id`/`department_id` foreign keys, and the `branch_id` index — and **no** `ALTER TABLE` on any existing table (the two back-relation fields from Task 1 produce no SQL). Read the generated `migration.sql` before trusting it, per the established verification habit in every prior story.

### 3 — DTOs

Create file: `apps/api/src/modules/sla-policies/dto/create-sla-policy.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { TicketPriority } from "@prisma/client";

export class CreateSlaPolicyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty()
  @IsInt()
  @Min(1)
  responseTargetMinutes!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  resolutionTargetMinutes!: number;
}
```

(`TicketPriority` here is imported purely as a TypeScript validation enum from the generated Prisma client — this is a type-level import, not a Prisma schema relation, and does not create the cross-schema database reference Settled decision 5 avoids. No `branchId` field — Task 4's service assigns it from `TenantContext`, never the client, exactly like `CreateCustomerDto`. No `isActive` field — every policy is created active.)

Create file: `apps/api/src/modules/sla-policies/dto/update-sla-policy.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { TicketPriority } from "@prisma/client";

export class UpdateSlaPolicyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  responseTargetMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  resolutionTargetMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

**Deliberately excluded:** explicit clearing of `departmentId`/`category`/`priority` back to `null` via update. Like `UpdateTicketDto`'s `assignedToUserId` (Story 07), `@IsOptional() @IsUUID()`-style fields here support *setting* a value but not explicitly *nulling* one — consistent with the existing precedent, not a new gap this story introduces.

### 4 — `SlaPoliciesService`

Create file: `apps/api/src/modules/sla-policies/sla-policies.service.ts`

Structure it after `customers.service.ts` — constructor-injected `PrismaService` + `TenantContext`; every method calls `tenantContext.requireBranchScope()`. Mirror `TicketsService.requireDepartmentInScope`'s exact check for the one cross-domain reference this model has:

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import type { TicketPriority } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateSlaPolicyDto } from "./dto/create-sla-policy.dto";
import type { UpdateSlaPolicyDto } from "./dto/update-sla-policy.dto";

export interface SlaPolicySummary {
  id: string;
  departmentId: string | null;
  category: string | null;
  priority: string | null;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isActive: boolean;
}

/**
 * Owns the `sla` schema — see docs/architecture/03-domain-boundaries.md
 * ("SLA & Automation"). `SlaPolicy` is a branch-scoped aggregate root, the
 * same shape as `Customer`/`Ticket` — never a sub-entity. This service does
 * not react to any Ticketing event and is not reacted to by anything; it
 * only stores policies for a future story to consume.
 */
@Injectable()
export class SlaPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createSlaPolicy(dto: CreateSlaPolicyDto): Promise<SlaPolicySummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    if (dto.departmentId) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
    }

    const policy = await this.prisma.slaPolicy.create({
      data: {
        branchId,
        departmentId: dto.departmentId ?? null,
        category: dto.category ?? null,
        priority: dto.priority ?? null,
        responseTargetMinutes: dto.responseTargetMinutes,
        resolutionTargetMinutes: dto.resolutionTargetMinutes,
      },
    });
    return toSlaPolicySummary(policy);
  }

  async listSlaPolicies(): Promise<SlaPolicySummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const policies = await this.prisma.slaPolicy.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    return policies.map(toSlaPolicySummary);
  }

  async getSlaPolicy(id: string): Promise<SlaPolicySummary> {
    const policy = await this.findSlaPolicyInScope(id);
    return toSlaPolicySummary(policy);
  }

  async updateSlaPolicy(id: string, dto: UpdateSlaPolicyDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    await this.findSlaPolicyInScope(id);

    if (dto.departmentId !== undefined) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
    }

    await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.responseTargetMinutes !== undefined
          ? { responseTargetMinutes: dto.responseTargetMinutes }
          : {}),
        ...(dto.resolutionTargetMinutes !== undefined
          ? { resolutionTargetMinutes: dto.resolutionTargetMinutes }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return { id };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findSlaPolicyInScope(id: string): Promise<{
    id: string;
    departmentId: string | null;
    category: string | null;
    priority: string | null;
    responseTargetMinutes: number;
    resolutionTargetMinutes: number;
    isActive: boolean;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, branchId } });
    if (!policy) {
      throw new NotFoundException("SLA policy not found");
    }
    return policy;
  }

  private async requireDepartmentInScope(departmentId: string, branchId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, branchId },
    });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }
}

function toSlaPolicySummary(policy: {
  id: string;
  departmentId: string | null;
  category: string | null;
  priority: string | null;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isActive: boolean;
}): SlaPolicySummary {
  return {
    id: policy.id,
    departmentId: policy.departmentId,
    category: policy.category,
    priority: policy.priority,
    responseTargetMinutes: policy.responseTargetMinutes,
    resolutionTargetMinutes: policy.resolutionTargetMinutes,
    isActive: policy.isActive,
  };
}
```

Note the `CreateSlaPolicyDto`/`UpdateSlaPolicyDto`'s `priority` field is typed `TicketPriority` (an imported TS enum, for `@IsEnum` validation), while `SlaPolicy.priority` and `SlaPolicySummary.priority` are plain `string | null` — the DTO validates the *shape* of what's accepted; the stored/returned type is the plain string the Prisma column actually is (per Settled decision 5).

### 5 — Controller

Create file: `apps/api/src/modules/sla-policies/sla-policies.controller.ts`

```typescript
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateSlaPolicyDto } from "./dto/create-sla-policy.dto";
import { UpdateSlaPolicyDto } from "./dto/update-sla-policy.dto";
import type { SlaPolicySummary } from "./sla-policies.service";
import { SlaPoliciesService } from "./sla-policies.service";

@ApiTags("sla-policies")
@ApiBearerAuth()
@Controller("sla-policies")
export class SlaPoliciesController {
  constructor(private readonly slaPoliciesService: SlaPoliciesService) {}

  @Post()
  @RequirePermissions("sla:create")
  create(@Body() dto: CreateSlaPolicyDto): Promise<SlaPolicySummary> {
    return this.slaPoliciesService.createSlaPolicy(dto);
  }

  @Get()
  @RequirePermissions("sla:read")
  list(): Promise<SlaPolicySummary[]> {
    return this.slaPoliciesService.listSlaPolicies();
  }

  @Get(":id")
  @RequirePermissions("sla:read")
  getOne(@Param("id") id: string): Promise<SlaPolicySummary> {
    return this.slaPoliciesService.getSlaPolicy(id);
  }

  @Patch(":id")
  @RequirePermissions("sla:update")
  update(@Param("id") id: string, @Body() dto: UpdateSlaPolicyDto): Promise<{ id: string }> {
    return this.slaPoliciesService.updateSlaPolicy(id, dto);
  }
}
```

### 6 — Module, `app.module.ts`, and seed

Create file: `apps/api/src/modules/sla-policies/sla-policies.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { SlaPoliciesController } from "./sla-policies.controller";
import { SlaPoliciesService } from "./sla-policies.service";

/**
 * Owns the `sla` schema — see docs/architecture/03-domain-boundaries.md
 * ("SLA & Automation"). `TenantContext` is provided here the same way
 * `CustomersModule`/`TicketsModule` provide it.
 */
@Module({
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService, TenantContext],
  exports: [SlaPoliciesService],
})
export class SlaPoliciesModule {}
```

File: `apps/api/src/app.module.ts` — add the import (alongside the existing `IdentityModule`/`CustomersModule`/`TicketsModule` imports, lines 14-16) and register it in the `imports` array (lines 31-33):

```typescript
import { SlaPoliciesModule } from "./modules/sla-policies/sla-policies.module";
// ...
  imports: [
    // ...
    IdentityModule,
    CustomersModule,
    TicketsModule,
    SlaPoliciesModule,
  ],
```

No guard, interceptor, or middleware changes — `AuthGuard`, `PermissionsGuard`, `AuditInterceptor`, and `TenantMiddleware` are already global and apply to `SlaPoliciesModule`'s routes automatically.

File: `apps/api/prisma/seed.ts` — extend `PERMISSION_CATALOG` (currently lines 19-29, ending in `"ticket:update"`):

```typescript
const PERMISSION_CATALOG = [
  "user:create",
  "user:read",
  "user:update",
  "role:read",
  "permission:read",
  "customer:create",
  "customer:read",
  "customer:update",
  "ticket:create",
  "ticket:read",
  "ticket:update",
  "sla:create",
  "sla:read",
  "sla:update",
] as const;
```

`ROLE_GRANTS` needs **no edit** — `SuperAdmin: PERMISSION_CATALOG` already grants the three new keys by reference; `Agent: []` stays exactly as-is, per Settled decision 7. Do **not** add any `SlaPolicy` rows to the seed script — per Settled decision 8.

### 7 — Tests

Create file: `apps/api/src/modules/sla-policies/sla-policies.service.spec.ts`

Structure exactly like `customers.service.spec.ts` (hand-built `PrismaService`/`TenantContext` mocks, no `Test.createTestingModule`). Cover:

- `createSlaPolicy`: assigns `branchId` from the mocked `tenantContext.requireBranchScope()`, never from any DTO field; throws `NotFoundException` when a provided `departmentId` isn't in the mocked branch; defaults `departmentId`/`category`/`priority` to `null` when omitted; passes through provided values when given.
- `listSlaPolicies`: calls `requireBranchScope()`, filters `prisma.slaPolicy.findMany` by that `branchId`.
- `getSlaPolicy`: throws `NotFoundException` for an unknown/out-of-scope id.
- `updateSlaPolicy`: throws `NotFoundException` for an unknown/out-of-scope id; throws `NotFoundException` when a provided `departmentId` isn't in scope; only includes DTO-present fields in `prisma.slaPolicy.update`'s `data`.

Create file: `apps/api/test/sla-policies.e2e-spec.ts`

Bootstrap the real `AppModule` exactly as `customers.e2e-spec.ts` does. Log in as the seeded admin. Obtain a real, in-scope `departmentId` via `GET /api/v1/auth/me` (the same pattern already used in `tickets.e2e-spec.ts` — there is no department-listing endpoint anywhere in this codebase, so this is the only way to get a real department id to test against). Cover, using `supertest(app.getHttpServer())`:

1. `GET /api/v1/sla-policies` with no `Authorization` header → `401`.
2. `POST /api/v1/sla-policies` with only `responseTargetMinutes`/`resolutionTargetMinutes` (no department/category/priority) → `201`; response has `departmentId: null`, `category: null`, `priority: null`, `isActive: true`.
3. `POST /api/v1/sla-policies` with the admin's own real `departmentId`, `category: "billing"`, `priority: "HIGH"` → `201`.
4. `POST /api/v1/sla-policies` with a random unknown `departmentId` → `404`.
5. `GET /api/v1/sla-policies` as admin → `200`, includes both created policies.
6. `GET /api/v1/sla-policies/:id` → `200`.
7. `GET /api/v1/sla-policies/:id` for a random unknown UUID → `404`.
8. `PATCH /api/v1/sla-policies/:id` (`{ responseTargetMinutes: 30, isActive: false }`) → `200`; a follow-up `GET` confirms both fields changed.
9. `PATCH /api/v1/sla-policies/:id` with an unknown `departmentId` → `404`.
10. Create an `Agent`-role user through the API (the exact pattern already used in `identity.e2e-spec.ts`/`customers.e2e-spec.ts`/`tickets.e2e-spec.ts`), log in as them, then `POST /api/v1/sla-policies` → `403` (the seeded `Agent` role has zero permissions).
11. The same Agent token on `GET /api/v1/sla-policies` → `403`.

---

## Edge Cases & Failure Modes

- **`responseTargetMinutes`/`resolutionTargetMinutes` missing, zero, or negative on create:** rejected by `@IsInt() @Min(1)` in `CreateSlaPolicyDto` — a `400`, not a policy with a nonsensical target.
- **`departmentId` from a different branch, on create or update:** rejected with `404` via `requireDepartmentInScope` — never `403`, never distinguishing "doesn't exist" from "exists in another branch," matching every other cross-domain check in this codebase (`TicketsService.requireDepartmentInScope`/`requireUserInScope`).
- **Unknown or cross-branch `SlaPolicy` id on read/update:** `404` via `findSlaPolicyInScope`'s branch-scoped `findFirst`, same convention as `Customer`/`Ticket`.
- **Two policies created with identical scoping dimensions (same branch, department, category, priority):** both are accepted — no uniqueness constraint exists (Settled decision 6). This is intentional: deciding which policy "wins" for a given ticket is a future story's concern, not this one's. Do not add a uniqueness constraint to "fix" this.
- **A policy with `departmentId`/`category`/`priority` all `null` (a branch-wide wildcard policy):** valid and explicitly supported — the doc's own scoping dimensions are all optional refinements, not required narrowing.
- **Attempting to clear `departmentId`/`category`/`priority` back to `null` via `PATCH`:** not supported by the current DTO shape (matches the existing `UpdateTicketDto.assignedToUserId` precedent) — a known, accepted limitation, not a bug to fix in this story.
- **A no-op `PATCH` (all fields omitted):** accepted, updates nothing meaningful, returns `200` — same behavior as `UpdateCustomerDto`/`UpdateTicketDto` with an empty body.
- **`prisma migrate dev` for `add_sla_policies` half-applies:** purely additive (new schema, one new table) — no existing data at risk; fix and re-run, per the precedent in every prior story.

---

## Test Plan

1. **Unit — `apps/api/src/modules/sla-policies/sla-policies.service.spec.ts` (new):** all cases in Task 7, following `customers.service.spec.ts`'s hand-built-mock pattern. No database dependency.
2. **Integration — `apps/api/test/sla-policies.e2e-spec.ts` (new):** the 11 scenarios in Task 7, against real Postgres/Redis.
3. **Regression — no changes, re-run only:** every existing unit spec (`identity.service.spec.ts`, `permissions.guard.spec.ts`, `customers.service.spec.ts`, `tickets.service.spec.ts`, `ticket-history.listener.spec.ts`) and every existing e2e spec (`identity.e2e-spec.ts`, `customers.e2e-spec.ts`, `tickets.e2e-spec.ts`) must still pass unmodified.

---

## Migration / Rollback

- Purely additive: one new Postgres schema (`sla`), one new table, two foreign keys (`branch_id` → `identity.branches`, `department_id` → `identity.departments`), one index. No existing table's columns, constraints, or data are touched.
- If the migration fails partway, fix and re-run — there is no existing data in the new table to lose, and no existing table is modified.
- Rolling back the feature entirely (if ever needed) means dropping the `sla` schema and removing the migration directory — not performed by this story.

---

## Verification Steps

1. **Prisma validates:** `pnpm --filter @crm/api prisma:validate` — must pass with the new model and both new back-relations, and confirm the cross-schema `Branch`/`Department` foreign keys resolve cleanly (the same pattern already proven by `Customer`/`Ticket`).
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` in the repository root — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
4. **Unit tests:** `pnpm --filter @crm/api test` — must run and pass the new `sla-policies.service.spec.ts` alongside every existing unit suite.
5. **Live migration + seed:** `docker compose up -d postgres redis`, `pnpm --filter @crm/api exec prisma migrate deploy`, `pnpm --filter @crm/api prisma:seed` (re-run once more to confirm idempotency — no duplicate permission rows).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e` — must pass, including the 11 new scenarios; capture full output as evidence.
7. **Regression:** confirm the full existing suite (unit + e2e) is unaffected.
8. **Hygiene:** `git status`/`git diff --stat -- .squad/config.yaml` — confirm the latter returns nothing.
9. **CI:** no `.github/workflows/ci.yml` changes needed. Confirm via `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] A dedicated `sla` Postgres schema exists, per `docs/architecture/03-domain-boundaries.md`.
- [ ] `SlaPolicy` exists with `branchId`, `departmentId` (nullable), `category` (nullable), `priority` (nullable, plain `String`), `responseTargetMinutes`, `resolutionTargetMinutes`, `isActive`, timestamps.
- [ ] All 4 endpoints (`POST/GET/GET :id/PATCH :id /sla-policies`) exist, DTO-validated, permission-checked (`sla:create`/`sla:read`/`sla:update`), Swagger-documented.
- [ ] SLA policies are branch-scoped via `TenantContext.requireBranchScope()` on every operation; a policy from another branch is never exposed.
- [ ] Unknown/out-of-scope ids return `404`, matching the existing Customer Management/Ticketing convention.
- [ ] `AuthGuard`/`PermissionsGuard`/`@RequirePermissions`/`TenantContext` are reused unchanged — no new authorization/tenancy mechanism.
- [ ] The migration is additive-only.
- [ ] `sla:create`/`sla:read`/`sla:update` are the only new permission keys; `SuperAdmin` is granted them via the `PERMISSION_CATALOG` reference; `Agent`'s grant is unchanged; the seed remains idempotent when re-run.
- [ ] Unit tests cover `SlaPoliciesService`; e2e tests cover authorization and the realistic branch-isolation failure shapes (unknown/cross-department id) available given the single-seeded-branch environment.
- [ ] The existing `ticket.created`/`ticket.updated` event contract is untouched; no listener, no `ticket.recategorized`, no business-hours calendar, no `sla-timers`, no BullMQ, no Socket.IO, no CASL, no `AutomationRule`, no other candidate domain was introduced.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
