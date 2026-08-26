# Story 07 — Ticketing: Ticket & Assignment Foundation

## Prerequisites

- `project-foundation` Stories 01–05 completed (see [../project-foundation/00-overview.md](../project-foundation/00-overview.md)): `TenantContext` (`apps/api/src/common/tenant/tenant-context.ts`), the globally-registered `AuthGuard`/`PermissionsGuard`/`ThrottlerGuard` and `AuditInterceptor` (`apps/api/src/app.module.ts` lines 31–37), and the Vitest/Supertest test conventions all exist exactly as built and are reused unchanged.
- `customer-management` Story 06 completed (see [../customer-management/00-overview.md](../customer-management/00-overview.md)): the real `Customer`/`Contact` models (`apps/api/prisma/schema.prisma` lines 183–217) this story's `Ticket.customerId`/`contactId` reference, and the `CustomersModule`/`CustomersService` pattern (`apps/api/src/modules/customers/`) this story mirrors exactly.
- This is the **first story of the new `ticketing` feature slug**. Per the settled decisions below, this story does not implement domain-event emission, CASL, ticket history, or any of Channels/SLA/Portal/Notifications/AI/Reporting — those are explicit, deliberate exclusions, not gaps to "notice" mid-implementation.

---

## Settled decisions (binding for this story — do not re-open)

1. **Domain events** (`ticket.created`/`ticket.updated`/`ticket.escalated`, named in `docs/architecture/03-domain-boundaries.md`): deferred to a later story. Do **not** install or use `@nestjs/event-emitter` (confirmed absent from `apps/api/package.json` and every source file — this would be a new dependency, not a reuse).
2. **CASL ticket-level visibility** (the worked example in `docs/architecture/05-auth-and-security.md` — "an agent may view a ticket only if it is assigned to them or unassigned within their department, unless escalated"): deferred to a later story. This story uses only the existing `AuthGuard` + `PermissionsGuard` + `TenantContext.requireBranchScope()`, exactly like `customer-management` Story 06 — branch-level scoping, not per-record CASL rules.
3. **Permission keys:** exactly `ticket:create`, `ticket:read`, `ticket:update`. No `ticket:assign` — reassignment happens through `ticket:update` (the `assignedToUserId` field on `UpdateTicketDto`, Task 4).
4. **Seed role grants:** `SuperAdmin` inherits the three new keys via `PERMISSION_CATALOG` reference (same mechanism as Story 06's `customer:*` keys — no separate `ROLE_GRANTS` edit needed). `Agent` stays `[]`, unchanged.
5. **`Ticket.contactId`:** included, nullable. A ticket always has a `customerId`; the specific `Contact` who raised it is optional.
6. **`Ticket.category`:** a nullable `String`. No `Category` model, lookup table, or enum in this story.

---

## Story Goal

Give the platform a real `ticketing` Postgres schema with one new Prisma model — **`Ticket`** — referencing the real `Customer`/`Contact` records Story 06 created, plus 4 permission-checked, branch-scoped REST endpoints, following exactly the module/service/controller/test shape `CustomersModule` established in Story 06.

1. `Ticket` is created in, and always read/updated within, the caller's own active branch (resolved from `TenantContext`, never a client-supplied `branchId`) — the same rule Story 06 applied to `Customer` creation.
2. Every cross-domain reference on a `Ticket` (`customerId`, `contactId`, `departmentId`, `assignedToUserId`) is verified to belong to the caller's active branch **before** the ticket is created or updated — this is new territory `CustomersService` never had to handle (it only ever referenced its own branch, never another domain's records), and is the main correctness risk this story must get right (see Edge Cases).
3. Assignment is not a separate concept — reassigning a ticket to an agent happens through `PATCH /tickets/:id` with `assignedToUserId`, permission-checked by the same `ticket:update` key as any other field edit.
4. No domain-event emission, no CASL, no ticket history/timeline, no Channels/SLA/Portal/Notifications/AI/Reporting code. `Ticket` is the **only** new table.

---

## Context — Read These Files First

1. [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — the `Ticketing` row (`ticketing` schema; owns "Tickets, categories, priorities, statuses, assignments, ticket history/timeline"; "Core entity; emits `ticket.created`, `ticket.updated`, and `ticket.escalated`"). Confirms the schema name; the named events are explicitly deferred per Settled decision 1.
2. [docs/architecture/04-data-and-multitenancy.md](../../../docs/architecture/04-data-and-multitenancy.md) — tickets (named explicitly, alongside customers) carry `branchId`; cross-branch access must be explicit and audited, never a default. This is why Task 4 verifies every cross-domain reference against the caller's branch before writing.
3. [docs/architecture/05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md) — the CASL example is specifically about ticket visibility; per Settled decision 2, this story does **not** build that rule — it is named here only so the executor understands why it's explicitly out of scope rather than an oversight.
4. `apps/api/prisma/schema.prisma` — lines 15–19 (`datasource.schemas`, currently `["identity", "admin", "customers"]`, to become `[..., "ticketing"]`); lines 36–48 (`Branch`, needs a `tickets Ticket[]` back-relation, same pattern as its existing `customers Customer[]` at line 44); lines 51–61 (`Department`, needs a `tickets Ticket[]` back-relation); lines 64–76 (`User`, needs a back-relation for `assignedToUserId`); lines 183–217 (`Customer`/`Contact`, each needs a `tickets Ticket[]` back-relation) — all schema-file-only additions (no scalar column, no migration SQL), exactly like Story 06's `Branch.customers` addition.
5. `apps/api/src/modules/customers/customers.service.ts` (whole file, 198 lines) — the exact shape to mirror: constructor-injected `PrismaService` + `TenantContext` (lines 33–38); `createCustomer` assigning `branchId` from `TenantContext`, never the DTO (lines 40–46); `listCustomers`/`getCustomer`/`updateCustomer` (lines 48–72); the private `findCustomerInScope`/`requireCustomerInScope` helpers (lines 134–154) and the "404 for out-of-scope, never 403" pattern they implement. `TicketsService` adds new helpers (`requireDepartmentInScope`, `requireUserInScope` — Task 4) for the cross-domain checks `CustomersService` never needed.
6. `apps/api/src/modules/customers/customers.controller.ts` (whole file, 39 lines) and `apps/api/src/modules/customers/customers.module.ts` (whole file, 20 lines) — the controller/module shape `TicketsController`/`TicketsModule` mirror.
7. `apps/api/src/modules/customers/dto/create-customer.dto.ts` and `dto/update-customer.dto.ts` (whole files) — the `class-validator`/`@ApiProperty` conventions (required vs. `@IsOptional()`).
8. `apps/api/prisma/seed.ts` — lines 19–28 (`PERMISSION_CATALOG`, now including the `customer:*` keys Story 06 added) and lines 33–36 (`ROLE_GRANTS`) — exactly what Task 6 appends three more keys to; `SuperAdmin: PERMISSION_CATALOG` already covers them by reference.
9. `apps/api/src/app.module.ts` — lines 13–14 and 28–29 (`imports` array, where `TicketsModule` is added alongside `IdentityModule`/`CustomersModule`) — no guard/interceptor/middleware changes needed, same as Story 06.
10. `apps/api/test/customers.e2e-spec.ts` (whole file) and `apps/api/src/modules/customers/customers.service.spec.ts` (whole file) — the exact bootstrap (`beforeAll`/`afterAll`, real `AppModule`, `ValidationPipe`, `setGlobalPrefix`, `cookieParser()`) and hand-built-mock unit-test pattern `tickets.e2e-spec.ts`/`tickets.service.spec.ts` copy. `tickets.e2e-spec.ts` additionally creates its `Customer` fixture through the **Customers API itself** (`POST /api/v1/customers`), not a direct DB insert — this is the first e2e suite that has a real prior-story API to build fixtures through, and doing so exercises the Story 06 → Story 07 seam for real.

---

## Implementation Tasks

### 1 — Prisma schema

File: `apps/api/prisma/schema.prisma`

Update the `datasource` block:

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), pg_trgm]
  schemas    = ["identity", "admin", "customers", "ticketing"]
}
```

Add back-relation fields to the **existing** `Branch`, `Department`, `User`, `Customer`, and `Contact` models — each is schema-file-only (no column, no migration SQL):

```prisma
model Branch {
  // ...unchanged fields...
  departments    Department[]
  userRoles      UserBranchRole[]
  customers      Customer[]
  tickets        Ticket[]
  createdAt      DateTime         @default(now()) @map("created_at")
  // ...
}

model Department {
  // ...unchanged fields...
  userRoles UserBranchRole[]
  tickets   Ticket[]
  createdAt DateTime         @default(now()) @map("created_at")
  // ...
}

model User {
  // ...unchanged fields...
  branchRoles      UserBranchRole[]
  refreshTokens    RefreshToken[]
  assignedTickets  Ticket[]
  createdAt        DateTime         @default(now()) @map("created_at")
  // ...
}

model Customer {
  // ...unchanged fields...
  contacts  Contact[]
  tickets   Ticket[]
  createdAt DateTime  @default(now()) @map("created_at")
  // ...
}

model Contact {
  // ...unchanged fields...
  isPrimary Boolean  @default(false) @map("is_primary")
  tickets   Ticket[]
  createdAt DateTime @default(now()) @map("created_at")
  // ...
}
```

Append a new section after the `customers` schema block, at the end of the file:

```prisma
// ---------------------------------------------------------------------------
// ticketing schema
// ---------------------------------------------------------------------------

/// See docs/architecture/03-domain-boundaries.md ("Ticketing"). Domain-event
/// emission (ticket.created/ticket.updated/ticket.escalated) and CASL-based
/// per-record visibility are named in the architecture but explicitly
/// deferred by this story — see the "Settled decisions" section of this
/// plan. `category` is a plain nullable String, not a lookup table — no
/// story has justified a `Category` model yet.
enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT

  @@schema("ticketing")
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED

  @@schema("ticketing")
}

model Ticket {
  id               String         @id @default(uuid())
  branchId         String         @map("branch_id")
  branch           Branch         @relation(fields: [branchId], references: [id])
  departmentId     String?        @map("department_id")
  department       Department?    @relation(fields: [departmentId], references: [id])
  customerId       String         @map("customer_id")
  customer         Customer       @relation(fields: [customerId], references: [id])
  contactId        String?        @map("contact_id")
  contact          Contact?       @relation(fields: [contactId], references: [id])
  assignedToUserId String?        @map("assigned_to_user_id")
  assignedToUser   User?          @relation(fields: [assignedToUserId], references: [id])
  subject          String
  category         String?
  priority         TicketPriority @default(MEDIUM)
  status           TicketStatus   @default(OPEN)
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  @@index([branchId])
  @@index([customerId])
  @@index([assignedToUserId])
  @@map("tickets")
  @@schema("ticketing")
}
```

Run `pnpm --filter @crm/api prisma:validate` after editing — must pass with no relation errors (five back-relations, five new `Ticket` foreign keys).

### 2 — Migration

With Docker Postgres up, run:

```bash
pnpm --filter @crm/api exec prisma migrate dev --name add_ticketing_schema
```

Must generate exactly one new migration containing `CREATE SCHEMA "ticketing"`, the two enum types, one `CREATE TABLE`, five foreign keys (`branch_id`, `department_id`, `customer_id`, `contact_id`, `assigned_to_user_id`), and the three indexes — and **no** `ALTER TABLE` on any existing `identity`/`admin`/`customers` table (the five back-relation fields from Task 1 produce no SQL).

### 3 — DTOs

Create file: `apps/api/src/modules/tickets/dto/create-ticket.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { TicketPriority } from "@prisma/client";

export class CreateTicketDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  subject!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
```

(No `branchId` field — Task 4's service assigns it from `TenantContext`, never the client, exactly like `CreateCustomerDto`. No `status` field — every ticket is created `OPEN`; there is no such thing as creating an already-resolved ticket in this design.)

Create file: `apps/api/src/modules/tickets/dto/update-ticket.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { TicketPriority, TicketStatus } from "@prisma/client";

export class UpdateTicketDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ required: false, enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
```

**Deliberately excluded from `UpdateTicketDto`:** `customerId`, `contactId`, `departmentId`. Settled decision 3 only requires assignment (`assignedToUserId`) to go through `ticket:update`; reassigning a ticket's customer, contact, or department is not named anywhere in this story's scope, and adding it would invent capability beyond what was asked. `assignedToUserId` also cannot be cleared to `null` in this story (unassignment) — only ever set to a real in-branch user id; explicit unassignment is not named in scope either and is left for a later story if needed.

### 4 — `TicketsService`

Create file: `apps/api/src/modules/tickets/tickets.service.ts`

Structure it after `customers.service.ts` — constructor-injected `PrismaService` + `TenantContext`; every method calls `tenantContext.requireBranchScope()`. The one genuinely new piece of logic (nothing in `CustomersService` needed this): **every cross-domain reference on the DTO must be verified to belong to the caller's active branch before the write happens** — a `Customer`, `Department`, or `User` from a different branch must never be attachable to a `Ticket` in this branch.

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateTicketDto } from "./dto/create-ticket.dto";
import type { UpdateTicketDto } from "./dto/update-ticket.dto";

export interface TicketSummary {
  id: string;
  subject: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: string;
  contactId: string | null;
  departmentId: string | null;
  assignedToUserId: string | null;
}

/**
 * Owns the `ticketing` schema — see docs/architecture/03-domain-boundaries.md
 * ("Ticketing"). Domain-event emission and CASL-based visibility are
 * explicitly deferred (see this plan's "Settled decisions") — every
 * authorization/scoping decision here is branch-level only, via
 * `TenantContext`, exactly like `CustomersService`.
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createTicket(dto: CreateTicketDto): Promise<TicketSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, branchId },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contactId, customerId: dto.customerId },
      });
      if (!contact) {
        throw new NotFoundException("Contact not found");
      }
    }

    if (dto.departmentId) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
    }

    if (dto.assignedToUserId) {
      await this.requireUserInScope(dto.assignedToUserId, branchId);
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        branchId,
        customerId: dto.customerId,
        contactId: dto.contactId ?? null,
        departmentId: dto.departmentId ?? null,
        assignedToUserId: dto.assignedToUserId ?? null,
        subject: dto.subject,
        category: dto.category ?? null,
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      },
    });
    return toTicketSummary(ticket);
  }

  async listTickets(): Promise<TicketSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const tickets = await this.prisma.ticket.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    return tickets.map(toTicketSummary);
  }

  async getTicket(id: string): Promise<TicketSummary> {
    const ticket = await this.findTicketInScope(id);
    return toTicketSummary(ticket);
  }

  async updateTicket(id: string, dto: UpdateTicketDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    await this.findTicketInScope(id);

    if (dto.assignedToUserId !== undefined) {
      await this.requireUserInScope(dto.assignedToUserId, branchId);
    }

    await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assignedToUserId !== undefined
          ? { assignedToUserId: dto.assignedToUserId }
          : {}),
      },
    });
    return { id };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findTicketInScope(id: string): Promise<{
    id: string;
    subject: string;
    category: string | null;
    priority: TicketPriority;
    status: TicketStatus;
    customerId: string;
    contactId: string | null;
    departmentId: string | null;
    assignedToUserId: string | null;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ticket = await this.prisma.ticket.findFirst({ where: { id, branchId } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
  }

  private async requireDepartmentInScope(departmentId: string, branchId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, branchId },
    });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }

  /** A "user in scope" means they hold at least one role in this branch — see UserBranchRole. */
  private async requireUserInScope(userId: string, branchId: string): Promise<void> {
    const membership = await this.prisma.userBranchRole.findFirst({
      where: { userId, branchId },
    });
    if (!membership) {
      throw new NotFoundException("User not found in this branch");
    }
  }
}

function toTicketSummary(ticket: {
  id: string;
  subject: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: string;
  contactId: string | null;
  departmentId: string | null;
  assignedToUserId: string | null;
}): TicketSummary {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    customerId: ticket.customerId,
    contactId: ticket.contactId,
    departmentId: ticket.departmentId,
    assignedToUserId: ticket.assignedToUserId,
  };
}
```

**Note:** every 404 here (`Customer not found`, `Contact not found`, `Department not found`, `User not found in this branch`, `Ticket not found`) is deliberately the same status a genuinely-nonexistent id would get — never a `403` and never a message distinguishing "doesn't exist" from "exists in another branch," exactly matching Story 06's `findCustomerInScope`/`requireCustomerInScope` precedent.

### 5 — Controller

Create file: `apps/api/src/modules/tickets/tickets.controller.ts`

```typescript
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import type { TicketSummary } from "./tickets.service";
import { TicketsService } from "./tickets.service";

@ApiTags("tickets")
@ApiBearerAuth()
@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @RequirePermissions("ticket:create")
  create(@Body() dto: CreateTicketDto): Promise<TicketSummary> {
    return this.ticketsService.createTicket(dto);
  }

  @Get()
  @RequirePermissions("ticket:read")
  list(): Promise<TicketSummary[]> {
    return this.ticketsService.listTickets();
  }

  @Get(":id")
  @RequirePermissions("ticket:read")
  getOne(@Param("id") id: string): Promise<TicketSummary> {
    return this.ticketsService.getTicket(id);
  }

  @Patch(":id")
  @RequirePermissions("ticket:update")
  update(@Param("id") id: string, @Body() dto: UpdateTicketDto): Promise<{ id: string }> {
    return this.ticketsService.updateTicket(id, dto);
  }
}
```

### 6 — Module and seed

Create file: `apps/api/src/modules/tickets/tickets.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

/**
 * Owns the `ticketing` schema — see docs/architecture/03-domain-boundaries.md
 * ("Ticketing"). `TenantContext` is provided here the same way
 * `CustomersModule` provides it — it has no dependencies beyond the ambient
 * `REQUEST` token, so nothing stops it being provided in more than one module.
 */
@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TenantContext],
  exports: [TicketsService],
})
export class TicketsModule {}
```

File: `apps/api/src/app.module.ts` — add the import (alongside `IdentityModule`/`CustomersModule`, lines 13–14 and 28–29):

```typescript
import { TicketsModule } from "./modules/tickets/tickets.module";
// ...
  imports: [
    // ...
    IdentityModule,
    CustomersModule,
    TicketsModule,
  ],
```

File: `apps/api/prisma/seed.ts` — extend `PERMISSION_CATALOG` (currently lines 19–28):

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
] as const;
```

`ROLE_GRANTS` needs **no edit** — `SuperAdmin: PERMISSION_CATALOG` already grants the three new keys by reference; `Agent: []` stays exactly as-is, per Settled decision 4. Do **not** add any `Ticket` rows to the seed script — the e2e suite (Task 7) creates its own `Customer`/`Ticket` fixtures through the real APIs.

### 7 — Tests

Create file: `apps/api/src/modules/tickets/tickets.service.spec.ts`

Structure exactly like `customers.service.spec.ts` (hand-built `PrismaService`/`TenantContext` mocks, no `Test.createTestingModule`). Cover:

- `createTicket`: throws `NotFoundException` when the customer isn't in scope; throws `NotFoundException` when a provided `contactId` doesn't belong to that customer; throws `NotFoundException` when a provided `departmentId` isn't in scope; throws `NotFoundException` when a provided `assignedToUserId` has no `UserBranchRole` in scope; on success, defaults `priority` to the Prisma-level default when omitted (assert the DTO's absence of `priority` results in no `priority` key in `prisma.ticket.create`'s `data`, letting the schema default apply) and passes through an explicit `priority` when given; defaults `contactId`/`departmentId`/`assignedToUserId` to `null` when omitted.
- `listTickets`: scopes by `branchId` via `requireBranchScope()`.
- `getTicket`: `NotFoundException` for an unknown/out-of-scope id.
- `updateTicket`: `NotFoundException` for an unknown/out-of-scope id; `NotFoundException` when a provided `assignedToUserId` isn't in scope (mock `userBranchRole.findFirst` → `null`); only includes DTO-present fields in `prisma.ticket.update`'s `data`.

Create file: `apps/api/test/tickets.e2e-spec.ts`

Bootstrap the real `AppModule` exactly as `customers.e2e-spec.ts` does. Log in as the seeded admin. Cover, using `supertest(app.getHttpServer())`:

1. `GET /api/v1/tickets` with no `Authorization` header → `401`.
2. Create a `Customer` fixture through `POST /api/v1/customers` (reusing Story 06's real endpoint, not a direct DB insert).
3. `POST /api/v1/tickets` referencing that customer → `201`; `status` in the response is `OPEN`, `priority` is `MEDIUM` when omitted from the request.
4. `POST /api/v1/tickets` with a random unknown `customerId` → `404`.
5. `GET /api/v1/tickets` as admin → `200`, includes the created ticket.
6. `GET /api/v1/tickets/:id` → `200`.
7. `GET /api/v1/tickets/:id` for a random unknown UUID → `404`.
8. `PATCH /api/v1/tickets/:id` (`{ status: "IN_PROGRESS", priority: "HIGH" }`) → `200`.
9. `PATCH /api/v1/tickets/:id` (`{ assignedToUserId: <the admin's own user id, from GET /auth/me> }`) → `200`; a follow-up `GET /api/v1/tickets/:id` shows the `assignedToUserId` set.
10. `PATCH /api/v1/tickets/:id` with a random unknown `assignedToUserId` → `404`.
11. Create an `Agent`-role user through the API (the exact pattern already used in `identity.e2e-spec.ts`/`customers.e2e-spec.ts`), log in as them, then `POST /api/v1/tickets` with that token → `403` (the seeded `Agent` role has zero permissions).

---

## Edge Cases & Failure Modes

- **A `customerId` that doesn't exist, or exists in a different branch:** both surface as `404` from `createTicket`'s branch-scoped `customer.findFirst` — never a `403`, never a message distinguishing the two cases, exactly like Story 06's `Customer`/`Contact` scoping.
- **A `contactId` that exists but belongs to a *different* `Customer`** (not necessarily a different branch — a contact from the *same* branch but the *wrong* customer): rejected with `404` by the `contact.findFirst({ where: { id: dto.contactId, customerId: dto.customerId } })` check — a contact is only valid for the specific customer it belongs to, regardless of branch.
- **A `departmentId`/`assignedToUserId` from a different branch:** both rejected with `404` via `requireDepartmentInScope`/`requireUserInScope` — this is the one genuinely new correctness surface in this story (Customer Management never referenced another domain's records), and is exactly why Task 4 adds these two helpers that `CustomersService` didn't need.
- **Assigning a ticket to a user who has no `UserBranchRole` at all anywhere** (e.g., a stale/deleted user id): the same `requireUserInScope` check catches this — `userBranchRole.findFirst` returns nothing, so it's `404`, not a Prisma FK-constraint `500`.
- **Empty `subject`:** rejected by `@IsString() @MinLength(1)` in `CreateTicketDto` — a `400`, not a blank ticket.
- **Unknown enum value for `priority`/`status`** (e.g. a typo'd string): rejected by `@IsEnum(TicketPriority)`/`@IsEnum(TicketStatus)` at the DTO layer — a `400`, never reaching Prisma (which would otherwise throw its own runtime error for an invalid enum value).
- **Unknown or cross-branch `Ticket` id on read/update:** `findFirst({ where: { id, branchId } })` returns `null` for both "doesn't exist" and "exists in another branch" — `404`, not `403`, same as every other lookup in this story and in Story 06.
- **A request with no active branch in `TenantContext`:** `requireBranchScope()` throws a plain `Error`, surfacing as an unhandled `500` — this is pre-existing behavior inherited from Story 02/06, not something this story changes.
- **`prisma migrate dev` for `add_ticketing_schema` half-applies:** purely additive (new schema, two enums, one table) — no existing data at risk; fix and re-run, same as Story 06's precedent. No `prisma migrate resolve` unless a partially-applied migration record genuinely needs it.

---

## Test Plan

1. **Unit — `apps/api/src/modules/tickets/tickets.service.spec.ts` (new):** all cases in Task 7, following `customers.service.spec.ts`'s hand-built-mock pattern. No database dependency.
2. **Integration — `apps/api/test/tickets.e2e-spec.ts` (new):** the 11 scenarios in Task 7, against real Postgres/Redis, building its `Customer` fixture through the real Customers API.
3. **Regression — no changes, re-run only:** `identity.service.spec.ts`, `permissions.guard.spec.ts`, `customers.service.spec.ts` (unit) and `identity.e2e-spec.ts`, `customers.e2e-spec.ts` (integration) must all still pass unmodified.

---

## Migration / Rollback

- Strictly additive: one new Postgres schema (`ticketing`), two new enum types, one new table, five new foreign keys into `identity`/`customers`. No existing table's columns, constraints, or data are touched.
- If the migration fails partway, fix and re-run — nothing in the new schema has data to lose, and no existing table is modified.
- Rolling back entirely (if ever needed) means dropping the `ticketing` schema and removing the migration directory — not performed by this story.

---

## Verification Steps

1. **Prisma validates:** `pnpm --filter @crm/api prisma:validate` — must pass with the new enums/model and all five back-relations.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
4. **Unit tests:** `pnpm --filter @crm/api test` — must run and pass `tickets.service.spec.ts` alongside every existing unit suite.
5. **Live migration + seed:** `docker compose up -d postgres redis`, `pnpm --filter @crm/api exec prisma migrate deploy`, `pnpm --filter @crm/api prisma:seed` (re-run once more to confirm idempotency).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e` — must pass, including the 11 new scenarios plus every existing identity/customers e2e scenario; capture full output as evidence.
7. **Regression:** re-run unit and e2e suites and confirm Identity & Access and Customer Management are unaffected.
8. **CI:** no `.github/workflows/ci.yml` changes needed. Confirm via `gh run list --workflow=ci.yml --limit 5` if reachable; otherwise report CI verification as explicitly pending, per the established precedent — never assumed.

## Done Criteria

- [ ] `Ticket` model (plus `TicketPriority`/`TicketStatus` enums) exists in a new `ticketing` schema exactly as specified; the migration is purely additive.
- [ ] All 4 endpoints (`POST /tickets`, `GET /tickets`, `GET /tickets/:id`, `PATCH /tickets/:id`) exist, DTO-validated, permission-checked, Swagger-documented.
- [ ] `ticket:create`, `ticket:read`, `ticket:update` are the only new permission keys; no `ticket:assign`.
- [ ] `SuperAdmin` is granted the three new keys via the seed's `PERMISSION_CATALOG` reference; `Agent`'s grant is unchanged (`[]`).
- [ ] `Ticket` create/list/read/update are all scoped to the caller's active branch via `TenantContext.requireBranchScope()`.
- [ ] `customerId`, `contactId`, `departmentId`, and `assignedToUserId` are all verified to belong to the caller's active branch (and, for `contactId`, to the specified customer) before any write.
- [ ] Reassignment happens through `PATCH /tickets/:id`'s `assignedToUserId`, with no separate `ticket:assign` permission.
- [ ] Unknown/out-of-scope ids return `404`; unauthenticated requests return `401`; permission-lacking requests return `403`.
- [ ] No `Ticket` fixture rows were added to `prisma/seed.ts`.
- [ ] `tickets.service.spec.ts` and `tickets.e2e-spec.ts` exist and pass, following the exact patterns of their Customer Management counterparts.
- [ ] No `@nestjs/event-emitter` dependency added; no domain events emitted; no CASL code introduced; no ticket history/timeline, Channels, SLA, Portal, Notifications, AI, or Reporting code introduced.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access + Customer Management) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
