# Data Strategy & Multi-Branch/Department Architecture

## Database strategy

- Use a **single PostgreSQL 16 database**, one Prisma schema file (`apps/api/prisma/schema.prisma`), and one Postgres logical schema per domain module via Prisma `@@schema(...)` multi-schema support.
- Prisma Migrate owns one migration history for the whole database. Feature stories add migrations for their domain; this story creates no feature tables.
- Attachment binaries live in S3-compatible object storage; Postgres stores key, filename, size, MIME type, and owning entity metadata.
- Postgres `tsvector`/`tsquery` provides initial Knowledge Base and ticket search. The `pgvector` extension is enabled for embeddings and AI retrieval.

## Multi-branch / multi-department model

The product serves one company operating multiple branches, each with multiple departments, rather than multiple independent customer companies.

- `Organization` is one explicit row for the CRM company, leaving a future partitioning key without pretending this is already multi-tenant SaaS.
- `Branch` belongs to `Organization` and represents a regional office.
- `Department` belongs to `Branch` and represents a function such as Support or Billing.
- Every scoped entity, including tickets, customers, branch-specific KB articles, and SLA policies, carries `branchId` and, where relevant, `departmentId`.

## Enforcement: `TenantContext`

- Each authenticated request resolves a request-scoped `TenantContext` from JWT claims and the user's selected branch. Users may belong to multiple branches/departments with different roles.
- A shared Prisma extension or repository base automatically applies `branchId` and applicable `departmentId` filters and stamps them on inserts.
- Cross-branch access is an explicit, audited permission, never a default.

## What this story does NOT build

No ticket, customer, SLA, or KB tables. Only the schema organization and `TenantContext` mechanism are decided here. The minimal `identity` seed tables are created in Story 02.
