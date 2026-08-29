> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Reporting & Analytics Foundation
- **Feature slug:** `reporting-analytics-foundation`

## Description

```text
Recon after Story 55 (which closed the Customer Portal domain and produced CSAT data) found
Reporting & Analytics as the next named-but-unstarted domain in the domain boundaries table, with
no external-provider blocker (unlike AI Services / the Integration Hub, both deferred). Scoped as a
foundation slice per the architecture doc's own "direct queries first" phasing: three branch-scoped
read-only endpoints (ticket volume by status, SLA compliance, CSAT average) over already-modeled
data, no new schema/migration.
```

## Acceptance criteria

```text
- GET /reports/ticket-volume, /reports/sla-compliance, /reports/csat all exist, gated by a new
  report:read permission, branch-scoped via TenantContext.
- SLA compliance and CSAT average are null (not 0/100) when there is no data yet.
- A new Agent Workspace "Reports" page renders all three as independent cards (one card's error
  never blocks another's data).
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and a frontend component test, cover the new surface.
- No existing service/controller is modified; this is a wholly new, additive module.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `ticketing` Story 07 (`Ticket`), `sla-breach-escalation` (`SlaEscalation`), `customer-portal-ticket-csat-feedback` Story 55 (`TicketCsatResponse`).

## Out of scope

- New `reporting` Prisma schema, materialized views, `reports-refresh` worker job, date-range
  filtering, ticket-aging buckets, per-agent performance breakdown, charts/graphs, export/download.
- Any README change.
