# project-foundation — plan overview

Entry point for the **project-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                                       | Title                                                                         | Tracker id | Depends on         |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- | ------------------ |
| 01  | [01-story-tech-stack-and-architecture-docs.md](./01-story-tech-stack-and-architecture-docs.md)             | Technology Stack Selection & Architecture Documentation                       | —          | None               |
| 02  | [02-story-monorepo-scaffolding.md](./02-story-monorepo-scaffolding.md)                                     | Monorepo & Environment Scaffolding                                            | —          | Story 01           |
| 03  | [03-story-identity-seed-and-user-management.md](./03-story-identity-seed-and-user-management.md)           | Identity & Access — Seed Data, Bootstrap Admin, and User/Role Management      | —          | Story 02           |
| 04  | [04-story-identity-test-suite-and-ci-integration.md](./04-story-identity-test-suite-and-ci-integration.md) | Identity & Access — Automated Test Suite and CI-Verified Database Integration | —          | Story 02, Story 03 |
| 05  | [05-story-identity-test-suite-live-verification.md](./05-story-identity-test-suite-live-verification.md)   | Identity & Access — Resolve Local Postgres Port Conflict and Verify Live Integration Suite | —          | Story 04            |

## Dependency notes

- Story 01 is documentation-only (`docs/architecture/*`) and decides the technology stack, domain boundaries, data/multi-tenancy model, auth model, and every other architecture concern named in the intake. It has no dependencies and blocks everything else in this repository.
- Story 02 implements Story 01's decisions as an actual repository skeleton (monorepo, four apps, two shared packages, minimal identity schema, local infra, CI). It must not re-decide anything Story 01 already settled.
- Story 03 completes the Identity & Access domain Story 02 scaffolded but left unusable (no seed data, no user-management endpoints) — still platform/foundation work, not a CRM feature, and introduces no new Prisma tables.
- Story 04 adds the first automated test suite (unit + integration) for the Identity & Access surface built by Stories 02–03, and works around this development machine's broken local Docker/WSL2 by verifying the integration suite through GitHub Actions service containers instead. No schema or endpoint changes.
- Story 05 picks up where Story 04's own deferred local verification left off: WSL2/Docker now work, but a native Windows PostgreSQL 18 service squats on port 5432 ahead of the Docker `pgvector/pgvector:pg16` container, so local Postgres traffic was silently reaching the wrong database. Story 05 diagnoses and resolves that conflict and produces real local evidence that the integration suite passes — no new tests, no schema or endpoint changes.
- Every future **CRM** feature (customer management, ticketing, communication channels, SLA/automation, knowledge base, AI, customer portal, reporting, administration screens, integrations) is a **new feature slug** under `.squad/plans/`, and its stories must read `docs/architecture/` before proposing a design — no future story should re-litigate stack, domain boundaries, or the multi-branch/department model.
