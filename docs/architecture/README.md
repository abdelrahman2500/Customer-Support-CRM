# Customer Support CRM — Architecture

This folder is the single source of truth for the platform's technical foundation. Every story that touches the backend, frontend, database, or infrastructure must read the relevant document(s) below before proposing a design. Decisions recorded here are binding; changing one requires updating the doc and calling out the change explicitly in the story that needs the change.

## Documents

1. [Technology Stack](./01-technology-stack.md) — the chosen stack and why.
2. [System Architecture Overview](./02-system-architecture-overview.md) — frontend, backend, and their boundary.
3. [Domain Boundaries](./03-domain-boundaries.md) — the bounded contexts / modules of the system.
4. [Data & Multi-Tenancy](./04-data-and-multitenancy.md) — database strategy, branch/department scoping.
5. [Auth & Security](./05-auth-and-security.md) — authentication, authorization, audit logging, security boundaries.
6. [Communication & Real-Time](./06-communication-and-realtime.md) — channels, WebSockets, background jobs, notifications.
7. [SLA, Automation & AI](./07-sla-automation-and-ai.md) — SLA/automation and AI integration, high level.
8. [Supporting Domains](./08-supporting-domains.md) — Knowledge Base, Customer Portal, Reporting — high level.
9. [Integrations](./09-integrations.md) — external systems (ERP, email/SMS/WhatsApp providers, public API).
10. [Internationalization & RTL](./10-i18n-and-rtl.md) — Arabic/English and RTL strategy.
11. [Quality & Operations](./11-quality-and-operations.md) — testing, observability, deployment/environments.
12. [Risks, Trade-offs & Scope](./12-risks-tradeoffs-and-scope.md) — known risks, trade-offs, and explicit non-goals.

## Status

Foundation established by Story 01 (this feature's plan: `.squad/plans/project-foundation/`). No feature code exists yet — see [Story 02](../../.squad/plans/project-foundation/02-story-monorepo-scaffolding.md) for the initial repository scaffolding that implements these decisions.
