# Story 223 — Knowledge base (agent) v2

> CRM product redesign roadmap item **PR-4.2** (RD-4.7). Intake: [`../../stories/knowledge-base-v2/knowledge-base-v2/intake.md`](../../stories/knowledge-base-v2/knowledge-base-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 4.

## Prerequisites

Story 211 (ListToolbar, FilterSelect).

## Story Goal

Read mode by default for articles; the list on the shared toolbar with a row menu.

**Non-goals:** rich text; AI suggestions.

## Design decisions

1. **Modes** — `mode: "read" | "edit"` (default read). The header keeps the title (its own Edit), status badge and publish; "Edit article" / "Done editing" (`aria-pressed`) switches. Attachments and version history render in both modes.
2. **Read view** — facts row (category name from the categories query, last update `<time>`, Arabic translation available / not yet), the body as `max-w-prose whitespace-pre-wrap text-body-lg`; when an AR translation exists, a SegmentedControl reads it (`lang="ar" dir="rtl"`), starting on the UI language.
3. **Editor** — `Tabs defaultValue` = the UI locale (RTL-04); fields, drafts and saves unchanged.
4. **List** — `ListToolbar` with `search.commitOnChange` (new, keeps the existing live search the Playwright flow relies on), category FilterSelect, plural count, clear all; `isFiltered` = search or category. Row menu ("Actions for {title}") with Open and Publish/Unpublish; Unpublish keeps its ConfirmDialog (the menu does not take focus back).

## Tasks

1. `@crm/ui` ListToolbar `commitOnChange` + spec; detail read view; list toolbar/menu; messages en/ar.
2. Specs: 16 detail tests gain the "Edit article" step, 4 list tests open the row menu, one status lookup is narrowed (the count is also a status) — reasons recorded; new read-mode and Arabic-reading tests.

## Verification Steps

1. web/ui vitest, typecheck, lint, build; Playwright full suite (kb-publish-portal-visibility).
2. Harness: list + read + edit at 390/1280 × en light / ar dark (live search, read default, editor tab language).

## Done Criteria

- [ ] RD-4.7 scope; saves unchanged; suites green.
