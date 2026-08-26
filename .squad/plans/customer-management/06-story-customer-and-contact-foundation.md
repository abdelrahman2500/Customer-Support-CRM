# Story 06 — Customer Management: Customer & Contact Foundation

## Prerequisites

- `project-foundation` Stories 01–05 completed (see [../project-foundation/00-overview.md](../project-foundation/00-overview.md)): `TenantContext` (`apps/api/src/common/tenant/tenant-context.ts`), the globally-registered `AuthGuard`/`PermissionsGuard`/`ThrottlerGuard` and `AuditInterceptor` (`apps/api/src/app.module.ts`), the `identity`/`admin` Prisma schema, and the Vitest/Supertest test conventions (Story 04) all exist exactly as built and are reused unchanged by this story.
- This is the **first story of the new `customer-management` feature slug**. Per `project-foundation`'s own dependency notes, this story does not re-decide stack, domain boundaries, or the multi-branch/department model — see [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) for the `Customer Management` → `customers` schema decision already made.

---

## Story Goal

Give the platform a real `customers` Postgres schema with two new Prisma models — **`Customer`** (the branch-scoped aggregate root, one per real-world account) and **`Contact`** (a person belonging to exactly one `Customer`) — and 7 permission-checked, branch-scoped REST endpoints over them, following exactly the module/service/controller/test shape `IdentityModule` established in Stories 02–04.

1. `Customer` is created in, and always read/updated within, the caller's own active branch (resolved from `TenantContext`, never from a client-supplied `branchId`) — this is a deliberate, stricter rule than `IdentityService.createUser`'s existing precedent of trusting a caller-supplied `branchId`; see `Edge Cases & Failure Modes` for why the two differ.
2. `Contact` has no independent lifecycle or permission namespace — it is always created/read/updated through its owning `Customer`, reusing the same `customer:*` permission keys.
3. No ticketing, channels, portal, interaction-history, or attachment/object-storage code is introduced. `Customer`/`Contact` are the **only** new tables — interaction history and attachment metadata are named under "Customer Management" in the domain-boundaries doc but depend on Ticketing/Channels events and object-storage wiring that don't exist yet, so they are not built here.

---

## Context — Read These Files First

1. [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — the `Customer Management` row (`customers` schema; owns "Customer profiles, contacts, interaction history, attachment metadata"). Confirms the schema name and that interaction history/attachments are named here but are **not** built by this story.
2. [docs/architecture/04-data-and-multitenancy.md](../../../docs/architecture/04-data-and-multitenancy.md) — the rule that customers (named explicitly) carry `branchId`, and that cross-branch access must be an explicit, audited permission, never a default. This is why Task 4 below auto-scopes `Customer` creation to `TenantContext`, not a DTO field.
3. `apps/api/prisma/schema.prisma` — lines 15–20 (the `datasource` block's `schemas` array, currently `["identity", "admin"]`, to become `["identity", "admin", "customers"]`); lines 36–48 (`Branch` model — needs a new back-relation field for `Customer`, see Task 1); lines 63–76 (`User` model) and lines 134–147 (`RefreshToken` model, its `@@index([userId])` at line 144) as the `@@map`/`@@schema`/`@@index` conventions the new models must follow exactly.
4. `apps/api/src/common/tenant/tenant-context.ts` — lines 27–65; `requireBranchScope()` (lines 59–64) is the exact method `CustomersService` must call for every create/list/read/update operation. Do not modify this file.
5. `apps/api/src/common/auth/require-permissions.decorator.ts` (whole file, 14 lines) and `apps/api/src/common/auth/permissions.guard.ts` (whole file, 54 lines) — reused as-is; no changes.
6. `apps/api/src/modules/identity/identity.service.ts` — lines 156–180 (`createUser`, the `$transaction`/`ConflictException` pattern), lines 188–204 (`listUsers`, the `requireBranchScope()` + Prisma `where` pattern), lines 206–221 (`updateUser`, the partial-update-only-present-fields pattern). `CustomersService` mirrors all three shapes.
7. `apps/api/src/modules/identity/users.controller.ts` (whole file, 56 lines) and `apps/api/src/modules/identity/identity.module.ts` (whole file, 29 lines) — the controller/module split and `@RequirePermissions(...)` usage `CustomersModule` mirrors.
8. `apps/api/src/modules/identity/dto/create-user.dto.ts` and `apps/api/src/modules/identity/dto/update-user.dto.ts` (whole files) — the `class-validator` + `@ApiProperty` DTO conventions (required vs. `@IsOptional()` fields).
9. `apps/api/prisma/seed.ts` — lines 19–25 (`PERMISSION_CATALOG`, a plain `as const` string array) and lines 30–33 (`ROLE_GRANTS`, `SuperAdmin: PERMISSION_CATALOG` / `Agent: []`) — exactly what Task 7 appends three keys to; `SuperAdmin`'s grant is already `PERMISSION_CATALOG` itself, so it needs no separate edit once the three keys are added to the catalog.
10. `apps/api/test/identity.e2e-spec.ts` (whole file, 185 lines) — the exact `beforeAll`/`afterAll` bootstrap (real `AppModule`, `ValidationPipe`, `setGlobalPrefix("api/v1", ...)`, `cookieParser()`, lines 35–46), and the in-test fixture pattern at lines 124–140/152–170 (create a second user via the API itself, using a role id fetched from `GET /identity/roles`, rather than adding seed data) — `customers.e2e-spec.ts` copies both.
11. `apps/api/src/modules/identity/identity.service.spec.ts` (whole file, 364 lines) and `apps/api/src/common/auth/permissions.guard.spec.ts` (whole file, 61 lines) — the hand-built-mock unit-test pattern (no `Test.createTestingModule` for pure unit tests; mocks are plain objects with `vi.fn()` members cast `as unknown as X`). `customers.service.spec.ts` copies this pattern.
12. `apps/api/src/app.module.ts` — lines 15–28 (`imports` array, where `CustomersModule` is added alongside `IdentityModule`) and lines 29–36 (global guard/interceptor providers — **no changes needed here**, `CustomersModule`'s routes are covered by the already-global `AuthGuard`/`PermissionsGuard`/`AuditInterceptor`).
13. `apps/api/src/main.ts` — lines 14–22 (global `ValidationPipe`/prefix/`cookieParser()` setup that `customers.e2e-spec.ts` must replicate in its own `beforeAll`, exactly as `identity.e2e-spec.ts` already does).
14. `apps/api/package.json` — lines 6–22 confirm `test`, `test:e2e`, and `prisma:seed` scripts already exist and need no changes.

---

## Product rules (from story)

- **Current:** no `customers` schema, no `Customer`/`Contact` models, no customer-related permission keys. `PERMISSION_CATALOG` (`apps/api/prisma/seed.ts` lines 19–25) contains only `user:create`, `user:read`, `user:update`, `role:read`, `permission:read`.
- **New:** a `customers` Postgres schema with `Customer` (branch-scoped aggregate root) and `Contact` (belongs to exactly one `Customer`) models; 7 permission-checked REST endpoints; three new permission keys (`customer:create`, `customer:read`, `customer:update`) granted to `SuperAdmin` only — `Agent`'s grant stays `[]`, unchanged, per this story's intake.

---

## Implementation Tasks

### 1 — Prisma schema

File: `apps/api/prisma/schema.prisma`

Change the `datasource` block's `schemas` array (currently at line 19):

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), pg_trgm]
  schemas    = ["identity", "admin", "customers"]
}
```

Add a back-relation field to the **existing** `Branch` model (currently lines 36–48) — Prisma requires both sides of a relation to be declared, but this is a **schema-file-only** addition: an array-typed relation field generates no column and no migration SQL, so this does **not** modify the `branches` table or violate "purely additive":

```prisma
model Branch {
  id             String           @id @default(uuid())
  organizationId String           @map("organization_id")
  organization   Organization     @relation(fields: [organizationId], references: [id])
  name           String
  timezone       String
  departments    Department[]
  userRoles      UserBranchRole[]
  customers      Customer[]
  createdAt      DateTime         @default(now()) @map("created_at")

  @@map("branches")
  @@schema("identity")
}
```

Append a new section after the `admin` schema block, at the end of the file:

```prisma
// ---------------------------------------------------------------------------
// customers schema
// ---------------------------------------------------------------------------

/// Aggregate root for the Customer Management domain — see
/// docs/architecture/03-domain-boundaries.md ("Customer Management").
/// Branch-scoped per docs/architecture/04-data-and-multitenancy.md; no
/// departmentId — departments route tickets, not customer identity, and no
/// story has justified department-scoping a customer yet.
model Customer {
  id          String    @id @default(uuid())
  branchId    String    @map("branch_id")
  branch      Branch    @relation(fields: [branchId], references: [id])
  displayName String    @map("display_name")
  isActive    Boolean   @default(true) @map("is_active")
  contacts    Contact[]
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([branchId])
  @@map("customers")
  @@schema("customers")
}

/// A person belonging to exactly one Customer — no independent lifecycle or
/// permission namespace (mutations reuse `customer:*`, see identity.service.ts
/// precedent for a sub-entity of an aggregate root, e.g. UserBranchRole).
/// Email is unique per Customer, never globally — the same real person's
/// email may legitimately appear under a different Customer.
model Contact {
  id         String   @id @default(uuid())
  customerId String   @map("customer_id")
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  fullName   String   @map("full_name")
  email      String?
  phone      String?
  isPrimary  Boolean  @default(false) @map("is_primary")
  createdAt  DateTime @default(now()) @map("created_at")

  @@unique([customerId, email])
  @@index([customerId])
  @@map("contacts")
  @@schema("customers")
}
```

Run `pnpm --filter @crm/api prisma:validate` after editing — it must pass with no relation errors.

### 2 — Migration

With Docker Postgres up (`docker compose up -d postgres redis`), run:

```bash
pnpm --filter @crm/api prisma migrate dev --name add_customers_schema
```

This must generate exactly one new migration under `apps/api/prisma/migrations/` containing `CREATE SCHEMA "customers"`, two `CREATE TABLE` statements, the `customer_id`/`branch_id` foreign keys, the `@@unique([customerId, email])` unique constraint, and the two indexes — and **no** `ALTER TABLE` on any `identity`/`admin` table (the `Branch.customers` field from Task 1 produces no SQL).

### 3 — DTOs

Create file: `apps/api/src/modules/customers/dto/create-customer.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  displayName!: string;
}
```

(No `branchId` field — Task 4's service assigns it from `TenantContext`, never from the client.)

Create file: `apps/api/src/modules/customers/dto/update-customer.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateCustomerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

Create file: `apps/api/src/modules/customers/dto/create-contact.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
```

Create file: `apps/api/src/modules/customers/dto/update-contact.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateContactDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
```

### 4 — `CustomersService`

Create file: `apps/api/src/modules/customers/customers.service.ts`

Structure it after `identity.service.ts` (constructor-injected `PrismaService` + `TenantContext`; every method that touches `Customer`/`Contact` calls `tenantContext.requireBranchScope()` first — either directly, for `Customer` operations, or indirectly via a shared `requireCustomerInScope` helper, for `Contact` operations):

```typescript
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateCustomerDto } from "./dto/create-customer.dto";
import type { UpdateCustomerDto } from "./dto/update-customer.dto";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { UpdateContactDto } from "./dto/update-contact.dto";

export interface CustomerSummary {
  id: string;
  displayName: string;
  isActive: boolean;
}

export interface ContactSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * Owns the `customers` schema — see docs/architecture/03-domain-boundaries.md
 * ("Customer Management"). `Customer` is the branch-scoped aggregate root;
 * `Contact` has no lifecycle or permission namespace of its own, so every
 * contact operation first confirms its parent `Customer` is inside the
 * caller's active branch via `requireCustomerInScope`.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createCustomer(dto: CreateCustomerDto): Promise<CustomerSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customer = await this.prisma.customer.create({
      data: { branchId, displayName: dto.displayName },
    });
    return toCustomerSummary(customer);
  }

  async listCustomers(): Promise<CustomerSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customers = await this.prisma.customer.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    return customers.map(toCustomerSummary);
  }

  async getCustomer(id: string): Promise<CustomerSummary & { contacts: ContactSummary[] }> {
    const customer = await this.findCustomerInScope(id);
    return { ...toCustomerSummary(customer), contacts: customer.contacts.map(toContactSummary) };
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto): Promise<{ id: string }> {
    await this.requireCustomerInScope(id);
    await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return { id };
  }

  async listContacts(customerId: string): Promise<ContactSummary[]> {
    await this.requireCustomerInScope(customerId);
    const contacts = await this.prisma.contact.findMany({
      where: { customerId },
      orderBy: { createdAt: "asc" },
    });
    return contacts.map(toContactSummary);
  }

  async createContact(customerId: string, dto: CreateContactDto): Promise<ContactSummary> {
    await this.requireCustomerInScope(customerId);
    try {
      const contact = await this.prisma.contact.create({
        data: {
          customerId,
          fullName: dto.fullName,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          isPrimary: dto.isPrimary ?? false,
        },
      });
      return toContactSummary(contact);
    } catch (error) {
      throw translateDuplicateEmail(error);
    }
  }

  async updateContact(
    customerId: string,
    contactId: string,
    dto: UpdateContactDto,
  ): Promise<{ id: string }> {
    await this.requireCustomerInScope(customerId);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }

    try {
      await this.prisma.contact.update({
        where: { id: contactId },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        },
      });
      return { id: contactId };
    } catch (error) {
      throw translateDuplicateEmail(error);
    }
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findCustomerInScope(
    id: string,
  ): Promise<{ id: string; displayName: string; isActive: boolean; contacts: ContactSummary[] }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customer = await this.prisma.customer.findFirst({
      where: { id, branchId },
      include: { contacts: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  private async requireCustomerInScope(id: string): Promise<void> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customer = await this.prisma.customer.findFirst({ where: { id, branchId } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
  }
}

function toCustomerSummary(customer: {
  id: string;
  displayName: string;
  isActive: boolean;
}): CustomerSummary {
  return { id: customer.id, displayName: customer.displayName, isActive: customer.isActive };
}

function toContactSummary(contact: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}): ContactSummary {
  return {
    id: contact.id,
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
  };
}

/**
 * A duplicate-email race that slips past the DB is caught here by Prisma's
 * `P2002` unique-constraint-violation code (backstopping the `@@unique([
 * customerId, email])` constraint from Task 1) and turned into the same
 * `ConflictException` a non-racing duplicate would get — never a raw 500.
 */
function translateDuplicateEmail(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
    return new ConflictException("A contact with this email already exists for this customer");
  }
  return error as Error;
}
```

**Note:** unlike `IdentityService.createUser` (which takes `branchId` from the DTO — see Task 6's plan file, `identity.service.ts` lines 156–180), `createCustomer` takes it **only** from `TenantContext.requireBranchScope()`. This is intentional and required by this story's intake — do not "fix" it to match `createUser`'s pattern.

### 5 — Controllers

Create file: `apps/api/src/modules/customers/customers.controller.ts`

```typescript
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import type { ContactSummary, CustomerSummary } from "./customers.service";
import { CustomersService } from "./customers.service";

@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions("customer:create")
  create(@Body() dto: CreateCustomerDto): Promise<CustomerSummary> {
    return this.customersService.createCustomer(dto);
  }

  @Get()
  @RequirePermissions("customer:read")
  list(): Promise<CustomerSummary[]> {
    return this.customersService.listCustomers();
  }

  @Get(":id")
  @RequirePermissions("customer:read")
  getOne(@Param("id") id: string): Promise<CustomerSummary & { contacts: ContactSummary[] }> {
    return this.customersService.getCustomer(id);
  }

  @Patch(":id")
  @RequirePermissions("customer:update")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto): Promise<{ id: string }> {
    return this.customersService.updateCustomer(id, dto);
  }
}
```

Create file: `apps/api/src/modules/customers/contacts.controller.ts`

```typescript
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import type { ContactSummary } from "./customers.service";
import { CustomersService } from "./customers.service";

/**
 * Contacts have no independent permission namespace — every route here
 * reuses `customer:*`, matching how a Contact has no lifecycle outside its
 * owning Customer. See docs/architecture/03-domain-boundaries.md.
 */
@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers")
export class ContactsController {
  constructor(private readonly customersService: CustomersService) {}

  @Post(":id/contacts")
  @RequirePermissions("customer:create")
  create(
    @Param("id") customerId: string,
    @Body() dto: CreateContactDto,
  ): Promise<ContactSummary> {
    return this.customersService.createContact(customerId, dto);
  }

  @Get(":id/contacts")
  @RequirePermissions("customer:read")
  list(@Param("id") customerId: string): Promise<ContactSummary[]> {
    return this.customersService.listContacts(customerId);
  }

  @Patch(":id/contacts/:contactId")
  @RequirePermissions("customer:update")
  update(
    @Param("id") customerId: string,
    @Param("contactId") contactId: string,
    @Body() dto: UpdateContactDto,
  ): Promise<{ id: string }> {
    return this.customersService.updateContact(customerId, contactId, dto);
  }
}
```

### 6 — Module

Create file: `apps/api/src/modules/customers/customers.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ContactsController } from "./contacts.controller";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

/**
 * Owns the `customers` schema — see docs/architecture/03-domain-boundaries.md
 * ("Customer Management"). `TenantContext` is provided here the same way
 * `IdentityModule` provides it (see identity.module.ts) — it has no
 * dependencies beyond the ambient `REQUEST` token, so nothing stops it being
 * provided in more than one module.
 */
@Module({
  controllers: [CustomersController, ContactsController],
  providers: [CustomersService, TenantContext],
  exports: [CustomersService],
})
export class CustomersModule {}
```

File: `apps/api/src/app.module.ts` — add the import (alongside the existing `IdentityModule` import at line 13 and its entry in the `imports` array at line 27):

```typescript
import { CustomersModule } from "./modules/customers/customers.module";
// ...
  imports: [
    // ...
    IdentityModule,
    CustomersModule,
  ],
```

No guard, interceptor, or middleware changes — `AuthGuard`, `PermissionsGuard`, `AuditInterceptor`, and `TenantMiddleware` are already global (`app.module.ts` lines 29–41) and apply to `CustomersModule`'s routes automatically.

### 7 — Seed: permission catalog only

File: `apps/api/prisma/seed.ts` — extend `PERMISSION_CATALOG` (currently lines 19–25):

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
] as const;
```

`ROLE_GRANTS` (lines 30–33) needs **no edit** — `SuperAdmin: PERMISSION_CATALOG` already grants every key added above by reference; `Agent: []` stays exactly as-is, per this story's intake ("Agent permissions remain unchanged").

Do **not** add any `Customer`/`Contact` rows to the seed script — the e2e suite (Task 8) creates its own fixtures through the API itself, exactly as `identity.e2e-spec.ts` creates its own Agent-role test user rather than relying on seeded data.

### 8 — Tests

Create file: `apps/api/src/modules/customers/customers.service.spec.ts`

Structure exactly like `identity.service.spec.ts` (hand-built `PrismaService`/`TenantContext` mocks, no `Test.createTestingModule`). Cover:

- `createCustomer`: assigns `branchId` from the mocked `tenantContext.requireBranchScope()`, never from any DTO field (assert the DTO has no `branchId` and the created payload's `branchId` matches the mock's).
- `listCustomers`: calls `requireBranchScope()`, filters `prisma.customer.findMany` by that `branchId`.
- `getCustomer`: throws `NotFoundException` when `prisma.customer.findFirst` resolves `null` (unknown id, or an id outside the mocked branch); returns `contacts: []` when the mocked customer has none.
- `updateCustomer`: throws `NotFoundException` for an unknown/out-of-scope id (mock `findFirst` → `null`, via `requireCustomerInScope`); only includes DTO-present fields in `prisma.customer.update`'s `data`.
- `createContact`: throws `NotFoundException` when the parent customer isn't in scope; on success, passes `email: null`/`phone: null`/`isPrimary: false` when the DTO omits them; catches a Prisma `P2002` (construct a `Prisma.PrismaClientKnownRequestError`-shaped mock, or mock `prisma.contact.create` to reject with `{ code: "P2002" }`) and rethrows as `ConflictException`.
- `updateContact`: `NotFoundException` for an unknown contact id (or one belonging to a different customer); the same `P2002` → `ConflictException` translation as `createContact`.
- `listContacts`: throws `NotFoundException` when the parent customer isn't in scope; otherwise scopes correctly.

Create file: `apps/api/test/customers.e2e-spec.ts`

Bootstrap the real `AppModule` exactly as `identity.e2e-spec.ts` does (lines 35–46: `Test.createTestingModule({ imports: [AppModule] }).compile()`, `cookieParser()`, `setGlobalPrefix("api/v1", ...)`, the same `ValidationPipe` options, `app.init()`). Log in as the seeded admin (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) to get `adminAccessToken`, exactly as `identity.e2e-spec.ts` lines 63–78. Cover, using `supertest(app.getHttpServer())`:

1. `GET /api/v1/customers` with no `Authorization` header → `401`.
2. `POST /api/v1/customers` as admin → `201`; body has `displayName` and `isActive: true`.
3. `GET /api/v1/customers` as admin → `200`, includes the created customer.
4. `GET /api/v1/customers/:id` as admin → `200`, `contacts: []`.
5. `GET /api/v1/customers/:id` for a random unknown UUID → `404`.
6. `PATCH /api/v1/customers/:id` (`{ displayName: "...", isActive: false }`) → `200`.
7. `POST /api/v1/customers/:id/contacts` (`{ fullName, email }`) → `201`.
8. Repeating step 7 with the **same** `email` on the **same** customer → `409`.
9. The same `email` on a **different** customer created in this suite → `201` (proves the uniqueness is per-customer, not global — directly exercises the intake's "Contact email is not globally unique" criterion).
10. `GET /api/v1/customers/:id/contacts` → `200`, includes the created contact.
11. `PATCH /api/v1/customers/:id/contacts/:contactId` → `200`.
12. Create an `Agent`-role user through the API (fetch the `Agent` role id from `GET /api/v1/identity/roles`, `POST /api/v1/identity/users` as admin — the exact pattern at `identity.e2e-spec.ts` lines 96–140), log in as them, then `POST /api/v1/customers` with that token → `403` (the seeded `Agent` role has zero permissions, per Task 7's unchanged `ROLE_GRANTS`).

**Known scope limit, not a defect to fix in this story:** `prisma/seed.ts` creates exactly one `Branch`. This suite therefore cannot exercise true cross-branch isolation end-to-end (there is no second branch/admin to attempt access from) — that path is covered by the unit tests in this task (mocking a `TenantContext` bound to a different `branchId` than the fixture data) instead. Do not add a second seeded branch to work around this; that would be seed-data added purely to satisfy a test, which the intake explicitly forbids.

---

## Edge Cases & Failure Modes

- **Empty `displayName`/`fullName`:** rejected by `@IsString() @MinLength(1)` in the DTOs (Task 3) before the request reaches `CustomersService` — a `400`, not a `500` or a silently-created blank record.
- **Non-ASCII (e.g. Arabic) text in `displayName`/`fullName`:** no special handling is needed or added — Postgres/Prisma store `text` as UTF-8 and `class-validator`'s `@IsString()` has no ASCII restriction. This is a verification point (confirm via a test case if convenient), not a code change; do not add locale-specific validation, which is out of this story's scope.
- **Duplicate `Contact.email` within the same `Customer`, whether submitted sequentially or concurrently:** enforced by the database-level `@@unique([customerId, email])` constraint (Task 1). Prisma `P2002` errors from `createContact`/`updateContact` are translated by `translateDuplicateEmail` (Task 4) into `ConflictException`/`409`. There is no application-level pre-check; the database constraint is the single source of truth and the correctness backstop for both a normal duplicate and a concurrent race — never an unhandled `500`.
- **Unknown or cross-branch `Customer`/`Contact` id:** `findFirst({ where: { id, branchId } })` (Task 4) returns `null` for both "genuinely doesn't exist" and "exists, but in a different branch" — both cases surface as `404`, **not** `403`. This is deliberate (it doesn't confirm to the caller that a record exists in another branch) and must not be changed to a `403` or to leak the record's real branch.
- **`Contact` operations on a customer outside the caller's branch:** `requireCustomerInScope`/`findCustomerInScope` (Task 4) run before any `Contact` read/write, so a `Contact` whose parent `Customer` is out of scope is unreachable — same `404` behavior as above, checked once per request rather than duplicated in every contact method.
- **A request with no active branch at all in `TenantContext`** (theoretically possible if a user's token has `branchId: null` — not reachable through today's `createUser`/seed flow, but not structurally prevented either): `requireBranchScope()` throws a plain `Error`, not a NestJS HTTP exception, which surfaces as an unhandled `500`. This is **pre-existing behavior** inherited from `TenantContext` (Story 02) and already true of `IdentityService.listUsers` today — this story must not change `TenantContext.requireBranchScope()`'s error type; that is a cross-cutting fix for a future story, not this one.
- **`prisma migrate dev` for `add_customers_schema` half-applies** (e.g. the process is killed mid-migration): the migration is purely additive (new schema, two new tables) — no existing data is at risk. Re-running `prisma migrate dev`/`prisma migrate deploy` after fixing whatever caused the interruption is sufficient; do not run `prisma migrate resolve` unless a partially-applied migration record genuinely needs to be marked resolved, per the precedent in `project-foundation` Story 05.

---

## Test Plan

1. **Unit — `apps/api/src/modules/customers/customers.service.spec.ts` (new):** all cases listed in Task 8, following `identity.service.spec.ts`'s hand-built-mock pattern. No database dependency.
2. **Integration — `apps/api/test/customers.e2e-spec.ts` (new):** the 12 scenarios listed in Task 8, against real Postgres/Redis (local `docker-compose` or CI's existing service containers — see `.github/workflows/ci.yml`, unchanged by this story).
3. **Regression — no changes, re-run only:** `apps/api/src/modules/identity/identity.service.spec.ts`, `apps/api/src/common/auth/permissions.guard.spec.ts`, `apps/api/test/identity.e2e-spec.ts` must all still pass unmodified.

---

## Migration / Rollback

- The migration is strictly additive: one new Postgres schema (`customers`), two new tables, their indexes/constraints, and the new FK from `customers.customers` to `identity.branches`. No existing table's columns, constraints, or data are touched.
- If `prisma migrate dev --name add_customers_schema` fails partway (e.g., a syntax issue caught mid-apply), fix the schema/migration file and re-run — there is no prior data in the new tables to lose, and no existing table is modified, so there is nothing to "roll back" beyond re-running the migration.
- Rolling back the feature entirely (if ever needed) means dropping the `customers` schema and removing the corresponding migration directory — not a step this story performs, since nothing else depends on this yet.

---

## Verification Steps

1. **Prisma validates:** `pnpm --filter @crm/api prisma:validate` in the repository root — must pass with the new models and the `Branch.customers` back-relation.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` in the repository root — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
4. **Unit tests:** `pnpm --filter @crm/api test` — must run and pass the new `customers.service.spec.ts` alongside the existing identity/permissions unit tests.
5. **Live migration + seed:** `docker compose up -d postgres redis`, `pnpm --filter @crm/api exec prisma migrate deploy`, `pnpm --filter @crm/api prisma:seed` (re-run once more to confirm idempotency — no new customer permission rows are duplicated).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e` — must pass, including the 12 scenarios in Task 8; capture full output as evidence, per the `project-foundation` Story 05 precedent.
7. **Regression:** re-run `pnpm --filter @crm/api test` and `pnpm --filter @crm/api test:e2e` and confirm the existing Identity & Access suites (`identity.service.spec.ts`, `permissions.guard.spec.ts`, `identity.e2e-spec.ts`) are unaffected.
8. **CI:** no `.github/workflows/ci.yml` changes are needed — its existing migrate/seed/test/test:e2e steps pick up the new migration, permission keys, and test files automatically. Confirm via `gh run list --workflow=ci.yml --limit 5` / `gh run view <run-id>` if `gh` is reachable; otherwise report CI verification as explicitly pending, per the `project-foundation` Story 05 precedent — never assumed.

## Done Criteria

- [ ] `Customer`/`Contact` Prisma models exist in a new `customers` schema exactly as specified; the migration is purely additive (no existing `identity`/`admin` table altered).
- [ ] All 7 endpoints (`POST /customers`, `GET /customers`, `GET /customers/:id`, `PATCH /customers/:id`, `POST /customers/:id/contacts`, `GET /customers/:id/contacts`, `PATCH /customers/:id/contacts/:contactId`) exist, are DTO-validated, permission-checked, and Swagger-documented.
- [ ] `customer:create`, `customer:read`, `customer:update` are the only new permission keys; no `customer:delete` and no separate `contact:*` keys exist.
- [ ] `SuperAdmin` is granted the three new keys via the seed's `PERMISSION_CATALOG` reference; `Agent`'s grant is unchanged (`[]`).
- [ ] `Customer` create/list/read/update are all scoped to the caller's active branch via `TenantContext.requireBranchScope()`; no endpoint accepts a client-supplied branch filter.
- [ ] `Contact` operations verify their parent `Customer` is in the caller's active branch before any read/write.
- [ ] Duplicate `Contact` email within the same `Customer` is rejected with `409`, both on a direct duplicate and on a `P2002` race; the same email under a different `Customer` succeeds.
- [ ] Unknown/out-of-scope `Customer`/`Contact` ids return `404`; unauthenticated requests return `401`; permission-lacking requests return `403`.
- [ ] No `Customer`/`Contact` fixture rows were added to `prisma/seed.ts`.
- [ ] `customers.service.spec.ts` and `customers.e2e-spec.ts` exist and pass, following the exact patterns of their Identity & Access counterparts.
- [ ] Full existing lint/typecheck/build/test suite (including `identity.service.spec.ts`, `permissions.guard.spec.ts`, `identity.e2e-spec.ts`) still passes with no regressions.
- [ ] No Ticketing, Channels, Portal, interaction-history, or attachment/object-storage code was introduced.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
