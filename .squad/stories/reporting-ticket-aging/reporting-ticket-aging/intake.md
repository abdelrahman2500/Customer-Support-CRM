> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Reporting & Analytics — Ticket Aging
- **Feature slug:** `reporting-ticket-aging`

## Description

```text
Recon after Story 59 found "ticket aging" as the last of Reporting's four named dimensions
(docs/architecture/08-supporting-domains.md) still unaddressed — volume, SLA, agent performance,
and CSAT are all shipped. Pure extension of the existing ReportingModule, no schema change, no new
permission, closing this domain's entire documented v1 scope.
```

## Acceptance criteria

```text
- GET /reports/ticket-aging exists, gated by the existing report:read permission, branch-scoped,
  returns all four fixed age buckets (0-1d/1-3d/3-7d/7d+) always, for OPEN/IN_PROGRESS tickets only.
- The existing Reports screen gets a fifth, independent card.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and a frontend component test, cover the new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `reporting-analytics-foundation` Story 56, `reporting-agent-performance` Story 59.

## Out of scope

- Time-to-resolution metrics, configurable bucket boundaries, a new permission, charts/histograms.
- Any README change.
