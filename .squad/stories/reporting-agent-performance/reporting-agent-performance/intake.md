> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Reporting & Analytics — Agent Performance
- **Feature slug:** `reporting-agent-performance`

## Description

```text
Recon after Story 58 found "agent performance" (docs/architecture/08-supporting-domains.md's four
Reporting dimensions) as the most distinctly-named, still fully unaddressed gap — Story 56 already
shipped ticket volume, SLA compliance, and CSAT. Pure extension of the existing ReportingModule, no
schema change, no new permission, reusing Ticket.assignedToUserId (already populated elsewhere).
Preferred over Administration/branding, the only other concrete gap, which would require a
first-of-its-kind cross-cutting CSS-theming change across both frontend apps.
```

## Acceptance criteria

```text
- GET /reports/agent-performance exists, gated by the existing report:read permission,
  branch-scoped, returns one row per agent with at least one assigned ticket:
  { userId, fullName, openCount, resolvedCount }.
- Unassigned tickets never appear in any row.
- The existing Reports screen gets a fourth, independent card.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and a frontend component test, cover the new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `reporting-analytics-foundation` Story 56.

## Out of scope

- Time-to-resolution/duration metrics, ticket-aging, a new permission, charts, per-agent drill-down.
- Any README change.
