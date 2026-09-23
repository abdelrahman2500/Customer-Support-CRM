> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/early-return-loading-accessibility/announce-early-return-query-loading-states/intake.md`

---

## Feature

- **Feature name (display):** Early-return loading accessibility
- **Feature slug (folder under `plans/`):** `early-return-loading-accessibility`

## Tracker (metadata only)

- **Work item id:** `165`
- **Labels:** ui, accessibility, design-system

---

## Title

```
Announce early-return query loading states
```

---

## Premise verification (measured at HEAD d8bf185)

**9** early-return query loading states, all `isLoading`, all component-level,
**0** mutations — re-located in the current code rather than taken from the
report:

| # | Site | Placeholder | Self-hiding? |
|---|---|---|---|
| 1 | `web branches/branch-departments-view:58` | inline bars | no |
| 2 | `web business-hours/business-hours-view:457` | inline bars | no |
| 3 | `web customers/customer-detail-view:490` | `CustomerDetailSkeleton` | **yes** |
| 4 | `web knowledge-base/article-detail-view:99` | `ArticleDetailSkeleton` | no → gains it |
| 5 | `web knowledge-base/article-detail-view:416` | bare `Skeleton` | no |
| 6 | `web tickets/ticket-detail-view:247` | `TicketDetailSkeleton` | **yes** |
| 7 | `web webhook-subscriptions/webhook-subscriptions-view:317` | bare `Skeleton` | no |
| 8 | `portal knowledge-base/article-detail-view:34` | `ArticleDetailSkeleton` | no → gains it |
| 9 | `portal tickets/ticket-detail-view:88` | `TicketDetailSkeleton` | **yes** |

Plus **2** `ArticleDetailSkeleton` definitions (web + portal) missing the
`aria-hidden` their `TicketDetailSkeleton`/`CustomerDetailSkeleton` siblings
have always carried.

**The constraint:** five of the nine return the *same component* that
`tickets/[id]`, `customers/[id]` and `knowledge-base/[id]` route-level
`loading.tsx` render. `RouteLoadingSkeleton`'s recorded decision is that a
route transition does not announce, because App Router moves focus into the new
page. So the announcement must go at the **call site**, never inside the shared
skeleton.

---

## Description

```
Story 162's guard scans `{q.isLoading && ...}` JSX branches. Nine loading
states are written as `if (q.isLoading) return ...` instead, so they were
never in view: nothing announced while a detail page loaded, and in four
cases the placeholder was left in the accessibility tree too.

Same defect, same primitive, different syntax.
```

---

## Acceptance criteria

```
- All 9 early returns announce through LoadingStatus, at the call site.
- Route-level loading.tsx behaviour unchanged: no shared skeleton gains a
  live region, and no loading.tsx file is touched.
- `placeholderHidden` chosen per site, not applied uniformly.
- Both ArticleDetailSkeletons gain aria-hidden, with no visual change.
- No query key/function/enabled/staleTime/retry/mutation/routing/RBAC change;
  no isLoading converted to isPending; no skeleton dimensions or layout
  changed.
- No new i18n key; EN/AR parity exact.
- The existing Story 162 guard is EXTENDED rather than duplicated, and its
  sensitivity spec proves the new arm catches the early-return form while
  ignoring route-level returns and mutation pending states.
```

---

## Out of scope

- Story 164's controls and the raw status enums (already fixed).
- The 6 raw status-palette usages.
- Navigation, FormField migration, Card/SectionCard, QueryStateCard refactors.
- New design tokens, backend, API, permissions/RBAC.
- Route-level `loading.tsx` announcements; skeleton visual redesign.
