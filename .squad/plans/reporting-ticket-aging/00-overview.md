# reporting-ticket-aging — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 60  | [60-story-reporting-ticket-aging.md](./60-story-reporting-ticket-aging.md) | Reporting & Analytics — Ticket Aging | — | `reporting-analytics-foundation` Story 56, `reporting-agent-performance` Story 59 |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) after Story 59. `docs/architecture/08-supporting-domains.md` names "ticket volume/aging, SLA, agent performance, and CSAT" as Reporting's four dimensions — Stories 56/59 shipped the other three; ticket aging is the last one, closing this domain's entire documented v1 scope.
- Pure extension of the already-shipped `ReportingModule` (Stories 56/59) — no new schema, no new permission, no new frontend pattern.
- Preferred over Administration/branding (still the only other concrete, non-blocked gap): branding remains a materially larger, first-of-its-kind cross-cutting theming change; this closes a small, already-half-finished domain instead.
- Communication/Channels, AI Services, and Integrations remain blocked on an unresolved external provider/credential (unchanged).
