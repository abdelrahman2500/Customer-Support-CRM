# Supporting Domains (high level): Knowledge Base, Customer Portal, Reporting

## Knowledge Base (high level)

- `knowledge_base.articles` has categories/tags, draft/published workflow, and versioning; publishing creates a new version rather than mutating published content.
- Postgres `tsvector` provides initial search, with `pgvector` embeddings alongside articles for semantic retrieval.
- Articles are consumed by the agent app, customer portal, and AI layer.

## Customer Portal (high level)

- `apps/portal` is separate because its audience, auth model, and branding differ from the agent app, while sharing backend infrastructure.
- `PortalModule` exposes only submit ticket, view and track own tickets, history, Knowledge Base browsing, and CSAT/feedback capabilities.
- Every portal query adds `customerId = currentCustomer.id` to normal branch/department scoping, preventing ID-guessing access to another customer's ticket.

## Reporting & Analytics (high level)

- Reporting starts with direct queries and materialized views in the `reporting` schema for ticket volume/aging, SLA, agent performance, and CSAT.
- `ReportingModule` exposes read-only aggregate endpoints for management dashboards; `reports-refresh` refreshes read models.
- A warehouse such as ClickHouse is deferred until query load or retention needs outgrow Postgres.

## Custom branding

Branding configuration (logo, colors, and per-branch identity) is owned by `AdminModule` in the `admin` schema and consumed by both Next.js apps through Tailwind CSS variables.
