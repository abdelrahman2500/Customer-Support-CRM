> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

## Feature

- **Feature name (display):** Customer Management
- **Feature slug (folder under `plans/`):** `customer-management`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Customer Management: Customer & Contact Foundation
```

---

## Description

```text
Establish the Customer Management domain as the foundation for Ticketing and other channel-facing features.

Implement real, branch-scoped Customer and Contact records in the dedicated `customers` PostgreSQL schema, with permission-checked CRUD operations and the existing global authentication, authorization, tenant-scoping, audit, validation, Swagger, and testing conventions.

Customer is the aggregate root and represents an account/company with multiple Contacts. A Customer belongs to one branch and can be soft-deactivated through `isActive`; hard deletion is not supported.

Contact belongs to exactly one Customer and represents a person associated with that customer. Contacts support optional email and phone values and an `isPrimary` flag.

The story must introduce the CustomersModule under `apps/api/src/modules/customers/`, including controllers, service, DTOs, Prisma models, migration, seed permission catalog/grants, unit tests, and an end-to-end test following the existing Identity test pattern.

The domain must remain isolated from Ticketing, Channels, Portal, interaction history, and attachment/storage functionality. Ticketing will consume the real Customer entity in a later story.
```

---

## Acceptance criteria

```text
- Customer and Contact Prisma models exist in the dedicated `customers` schema.
- Customer contains:
  - id (UUID primary key)
  - branchId (UUID, required FK to identity.Branch)
  - displayName
  - isActive (default true)
  - createdAt
  - updatedAt
- Contact contains:
  - id (UUID primary key)
  - customerId (required FK to Customer)
  - fullName
  - email (optional)
  - phone (optional)
  - isPrimary (default false)
  - createdAt
- Customer → Contact is a one-to-many relationship.
- Contact deletion cascades when its Customer is removed at the database relation level.
- Customer is branch-scoped and all list/read operations enforce the caller's active branch through TenantContext.requireBranchScope().
- Client-supplied branch filtering is not accepted for list/read operations.
- Customer creation assigns the Customer to the caller's active branch through TenantContext rather than trusting a caller-supplied branchId.
- The following endpoints exist:
  - POST /api/v1/customers
  - GET /api/v1/customers
  - GET /api/v1/customers/:id
  - PATCH /api/v1/customers/:id
  - POST /api/v1/customers/:id/contacts
  - GET /api/v1/customers/:id/contacts
  - PATCH /api/v1/customers/:id/contacts/:contactId
- All endpoints are authenticated and permission-checked using the existing AuthGuard and PermissionsGuard.
- Required permissions are:
  - customer:create
  - customer:read
  - customer:update
- Contact mutations reuse the customer:* permission namespace because Contacts have no independent lifecycle outside their Customer.
- No customer:delete permission or hard-delete API endpoint is introduced.
- Customer and Contact request bodies are DTO-validated using the existing project validation conventions.
- All endpoints are Swagger-documented following the existing API conventions.
- Duplicate Contact email within the same Customer is rejected with HTTP 409.
- Contact email is not globally unique and may exist under different Customers.
- Requests for unknown Customer or Contact resources return HTTP 404.
- Unauthenticated requests return HTTP 401.
- Authenticated users without the required permission return HTTP 403.
- Customer list/read operations cannot access records belonging to another branch.
- Customer update operations cannot update a Customer outside the caller's active branch.
- Contact operations verify that the target Contact belongs to a Customer within the caller's active branch.
- The customers schema migration is purely additive and does not modify existing identity or admin tables.
- Seed data adds customer:create, customer:read, and customer:update to the permission catalog.
- SuperAdmin receives the customer:* permissions through the seed configuration.
- Agent permissions remain unchanged unless explicitly required by the existing authorization design.
- No Customer or Contact fixture rows are added to the seed data.
- Unit tests cover Customer create/list/update behavior.
- Unit tests cover Contact create/list/update behavior.
- Unit tests cover branch-scoping behavior.
- Unit tests cover duplicate Contact email rejection.
- Unit tests cover unknown-resource 404 behavior where applicable.
- customers.e2e-spec.ts follows the existing identity.e2e-spec.ts bootstrap and authentication pattern.
- The e2e suite creates its own Customer and Contact fixture data and does not depend on seeded Customer/Contact rows.
- Existing lint, typecheck, build, and test suites continue to pass.
- No changes are made to Ticketing, Channels, Portal, interaction history, or attachment/storage functionality.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** None.
- **Depends on code areas or other stories:**

  - Project Foundation Stories 01–05 must be complete.
  - Reuses TenantContext from the foundation.
  - Reuses global AuthGuard and PermissionsGuard.
  - Reuses the existing AuditInterceptor.
  - Reuses existing DTO validation and Swagger conventions.
  - Reuses Identity e2e bootstrap/authentication patterns.
  - Extends the existing Prisma multi-schema configuration with the `customers` schema.

## Extra notes (optional)

- Customer is modeled as an account/company with multiple Contacts.
- Customer creation should use the caller's active branch from TenantContext rather than accepting a client-controlled branchId.
- `departmentId` is intentionally not part of Customer in this story; departments route tickets rather than define customer identity.
- Contact email uniqueness is scoped to the Customer.
- No pagination, search, filtering, import/export, merging, or bulk operations are introduced.
- Audit logging is already handled globally; no Customer-specific audit implementation is required.

## Technical hints (optional)

- APIs:

  - `POST /api/v1/customers`
  - `GET /api/v1/customers`
  - `GET /api/v1/customers/:id`
  - `PATCH /api/v1/customers/:id`
  - `POST /api/v1/customers/:id/contacts`
  - `GET /api/v1/customers/:id/contacts`
  - `PATCH /api/v1/customers/:id/contacts/:contactId`

- Primary module root: `apps/api/src/modules/customers/`
- Suggested files:

  - `customers.module.ts`
  - `customers.controller.ts`
  - `contacts.controller.ts`
  - `customers.service.ts`
  - `dto/*`
  - `customers.service.spec.ts`
  - `apps/api/test/customers.e2e-spec.ts`

- Prisma:

  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/`
  - `apps/api/prisma/seed.ts`

- Existing patterns to follow:

  - IdentityService branch scoping
  - `TenantContext.requireBranchScope()`
  - `@RequirePermissions(...)`
  - `identity.e2e-spec.ts`

- Repository root: `.`
- Primary language: `typescript`

## Out of scope

- Ticketing or Ticket entities.
- Channels or omnichannel functionality.
- Customer Portal authentication or self-service.
- Interaction-history implementation.
- Attachment metadata or object-storage integration.
- Customer search or advanced filtering.
- Pagination.
- Customer merging or deduplication workflows.
- Bulk customer/contact operations.
- Import/export.
- AI functionality.
- Reporting.
- SLA functionality.
- Customer-specific audit infrastructure.
- Hard deletion of Customers.
- Separate `contact:*` permission keys.
- `departmentId` on Customer.
- Customer data in seed fixtures.
