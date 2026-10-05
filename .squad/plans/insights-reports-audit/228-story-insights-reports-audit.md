# Story 228 — Insights: reports and audit log

> CRM product redesign roadmap item **PR-4.7**. Intake: [`../../stories/insights-reports-audit/insights-reports-audit/intake.md`](../../stories/insights-reports-audit/insights-reports-audit/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 4.

## Prerequisites

Stories 211, 221.

## Story Goal

Reports and the Audit log share the product's list/toolbar vocabulary, keep their filters in the URL, and speak the reader's language.

**Non-goals:** new reports; an audit actor picker; backend changes.

## Design decisions

1. **One toolbar** — `ListToolbar` holds the date pair, the three FilterSelects and the cross-branch checkbox (Filters sheet below `sm`); "Clear all" replaces the date-only Clear; the saved-view picker and its actions sit in `actions`.
2. **URL** — `useUrlFilters` with `from`, `to`, `department`, `agent`, `category`, `crossBranch=1`, `view`. Every hook still receives the same `ReportDateRange`.
3. **KPI row** — four `StatCard`s from the existing queries; "—" when there is nothing to measure.
4. **Page-level failure** — when every rendered widget's query fails with the same kind (forbidden / invalid range / error), one `ErrorState` replaces the KPI row and grid (one retry refetches all); the toolbar stays so the cause can be changed.
5. **Units** — `Intl` with `<locale>-u-nu-latn` (PD-8) for currency, percent and decimals; `units.hoursMinutes` / `units.minutes` for durations.
6. **Grid** — at most three columns (six squeezed headings to a word per line).
7. **Audit log** — `ListToolbar`; `describeAction` maps the identity domain's named actions and `METHOD /path` request entries to messages (path shown beside the verb); entity types likewise; rows with a diff get "View changes" opening a Sheet with a DescriptionList and the JSON.

## Tasks

1. Reports view, messages (en/ar), spec (navigation mock, URL/KPI/failure tests).
2. Audit view, messages, spec (sheet, labels, clear-all tests).

## Verification Steps

1. web vitest, typecheck, lint, build; Playwright full suite.
2. Harness: both screens at 390/1280 × en light / ar dark; URL round-trip; agent without the permission sees one message.

## Done Criteria

- [ ] Toolbar, URL, KPI row, failure state, units, audit labels and Sheet; suites green.
