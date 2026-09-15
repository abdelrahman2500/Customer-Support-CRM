# Risks, Trade-offs & Explicit Non-Goals

## Key trade-offs made in this architecture

| Trade-off                            | Choice made                                         | Why                                                                               | Revisit when                                                                      |
| ------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Modular monolith vs. microservices   | Modular monolith with in-process events             | Avoids distributed-systems complexity while boundaries preserve future extraction | A module needs independent scaling/deploys or causes resource contention          |
| One database vs. database-per-domain | One Postgres database with logical schemas          | Cheaper to operate and supports cross-domain reporting                            | A domain's volume or availability requirements diverge materially                 |
| REST vs. GraphQL                     | REST + OpenAPI                                      | Fits CRUD/workflow operations and external integrations                           | A concrete consumer makes over/under-fetching a real problem                      |
| Self-hosted auth vs. vendor          | JWT + RBAC/CASL                                     | Controls branch claims and audit requirements without vendor billing              | Enterprise SSO with a specific IdP is required                                    |
| Build vs. buy channels               | Buy provider delivery, build orchestration/adapters | Channel delivery is not product value                                             | Not expected to be revisited                                                      |
| AI vendor                            | Anthropic Claude behind `AiProvider`                | Quality with provider portability                                                 | Cost, latency, or feature needs justify another provider                          |
| Search                               | Postgres `tsvector` (`pgvector` deferred)           | Avoids infrastructure until measured need                                         | Relevance or latency becomes a measured problem                                   |
| Analytics                            | Postgres materialized views                         | Avoids premature warehouse infrastructure                                         | Reporting load or retention outgrows Postgres                                     |
| Multi-branch vs. multi-company       | Single `Organization` → `Branch` → `Department`     | Matches the actual one-company requirement                                        | The business must host separate customer companies; then isolation needs redesign |

## Major technical risks

1. **RTL/i18n regressions**: physical-direction CSS silently breaks Arabic layouts. New code using `ml-`, `mr-`, `left-`, or `right-` should be treated as a defect.
2. **Domain-event discipline erosion**: direct cross-module calls can turn the modular monolith into a tangled system and close off extraction.
3. **AI cost/latency**: chatbot calls can affect API responsiveness and cost; monitor latency and cost separately from asynchronous AI work.
4. **Single-organization assumption**: changing to true SaaS multi-tenancy would be a data-model migration, not a configuration change.
5. **Undecided production hosting**: the platform is cloud-agnostic through containers, but hosting must be resolved before a production deployment story.

## Explicit non-goals of this foundation story

> **Historical scope note (added during finalization documentation pass;
> the original list below is preserved unedited).** This section records
> Story 02's own explicit non-goals, as declared when only the
> foundational `identity`-only schema and per-app scaffolding existed. It
> is a historical snapshot, **not** a statement of current scope — every
> domain named below except the last has since been implemented
> (customer management, ticketing, SLA & automation, realtime, Knowledge
> Base, AI-assisted operations, the Customer Portal, reporting, and
> administration are all real, working domains today; a partial
> Integration Hub — API keys and outbound webhooks — also exists). See
> the root [`README.md`](../../README.md)'s "Current capabilities" and
> "Project Status" sections for the current, evidence-based status of
> each domain, and [`03-domain-boundaries.md`](./03-domain-boundaries.md)
> for the current domain table. Of the six bullets below, only "No
> production hosting platform decision" is still true today.

- No customer, ticketing, channel, agent dashboard, SLA, automation, Knowledge Base, AI, portal, reporting, administration, or integration feature implementation.
- No complete database schema; only minimal `identity` tables needed for scoping are created in Story 02.
- No complete API endpoints beyond health checks and auth scaffolding.
- No complete frontend screens beyond per-app placeholders.
- No production deployment or third-party account provisioning.
- No production hosting platform decision.
