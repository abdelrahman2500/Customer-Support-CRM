# project-foundation — plan overview

Entry point for the **project-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-tech-stack-and-architecture-docs.md](./01-story-tech-stack-and-architecture-docs.md) | Technology Stack Selection & Architecture Documentation | — | None |
| 02 | [02-story-monorepo-scaffolding.md](./02-story-monorepo-scaffolding.md) | Monorepo & Environment Scaffolding | — | Story 01 |

## Dependency notes

- Story 01 is documentation-only (`docs/architecture/*`) and decides the technology stack, domain boundaries, data/multi-tenancy model, auth model, and every other architecture concern named in the intake. It has no dependencies and blocks everything else in this repository.
- Story 02 implements Story 01's decisions as an actual repository skeleton (monorepo, four apps, two shared packages, minimal identity schema, local infra, CI). It must not re-decide anything Story 01 already settled.
- Every future feature (customer management, ticketing, communication channels, SLA/automation, knowledge base, AI, customer portal, reporting, administration, integrations) is a **new feature slug** under `.squad/plans/`, and its stories must read `docs/architecture/` before proposing a design — no future story should re-litigate stack, domain boundaries, or the multi-branch/department model.
