# reporting-agent-performance — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 59  | [59-story-reporting-agent-performance.md](./59-story-reporting-agent-performance.md) | Reporting & Analytics — Agent Performance | — | `reporting-analytics-foundation` Story 56 (`ReportingModule`), `ticketing` (`Ticket.assignedToUserId`) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) after Story 58. `docs/architecture/08-supporting-domains.md` names four Reporting dimensions ("ticket volume/aging, SLA, agent performance, and CSAT"); Story 56 shipped volume, SLA compliance, and CSAT. Agent performance and ticket aging are the two still fully unaddressed — this story closes the former.
- Preferred over ticket aging (also unblocked, also well-scoped): agent performance is the more distinctly-named, still-fully-missing dimension, since Story 56 already touched "volume" (aging is bundled with it in the doc's own phrasing). Aging remains a strong candidate for a future Recon cycle.
- Preferred over Administration/branding (the only other concrete unblocked gap): branding requires a first-of-its-kind cross-cutting change (dynamic runtime CSS-variable theming injected into both `apps/web` and `apps/portal`'s root layouts) that the architecture risk log itself flags as hazardous ("RTL/i18n regressions") — a materially larger, riskier lift than this foundation-extension story.
- No new schema/migration/permission — a pure extension of the already-shipped `ReportingModule` (Story 56), using `Ticket.assignedToUserId` (already populated, already used elsewhere) via one more `groupBy` query.
- Communication/Channels, AI Services, and Integrations remain blocked on an unresolved external provider/credential (unchanged).
