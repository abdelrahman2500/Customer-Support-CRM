> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/query-loading-accessibility/standardize-remaining-query-loading-accessibility/intake.md`

---

## Feature

- **Feature name (display):** Query loading accessibility
- **Feature slug (folder under `plans/`):** `query-loading-accessibility`

## Tracker (metadata only)

- **Work item id:** `162`
- **Labels:** ui, accessibility, design-system

---

## Title

```
Standardize remaining query loading accessibility
```

---

## Premise verification (measured at HEAD 3c35f50)

Story 161's recon reported 18 remaining query loading branches rendering a
skeleton with no live region. Re-measured and classified: **18 confirmed**, and
a wider-window scan written for the guard then found a **19th**
(`portal/notification-history-view.tsx:143`), whose branch is longer than the
original scan's window.

| Property | Count |
|---|---|
| genuine **query** loading states | **19** |
| **mutation** pending states (must not be touched) | **0** |
| `isLoading` | 12 |
| `isPending` (all on `use*Query` hooks, i.e. v5 first-load) | 7 |

Structural classification:

| Shape | Count | Treatment |
|---|---|---|
| `group` — `{q.isX && (` over a `<div className>` of bars | 9 | `LoadingStatus` becomes the wrapper, carrying its className |
| `single` — one bare `<Skeleton className=… />` | 8 | `LoadingStatus asChild`; no element added |
| `indirect` — `reports-view`'s local `ReportCardSkeleton` | 1 | fixed **inside** the component, which already owns its wrapper |
| `partly meaningful` — portal notification history's real `Table` | 1 | needs the one API addition (below) |

---

## Description

```
Story 161 built `LoadingStatus` and applied it to the 24 complete four-branch
ladders. The branches it deliberately deferred -- partial and distributed
loading states -- carry the identical defect: no live region, and a bare
`Skeleton` left in the accessibility tree.

This finishes the job. It is accessibility-only: no skeleton, empty state,
error state, layout or query option changes.
```

---

## Acceptance criteria

```
Accessibility
- Every genuine query loading branch that renders a skeleton announces itself
  through LoadingStatus, with role="status" and aria-busy.
- The visual placeholder is hidden from assistive technology, except where the
  placeholder carries real content the screen deliberately keeps announced.
- No background refetch is announced; loading conditions are unchanged.

Visual preservation
- Skeleton shape, count, dimensions, spacing, margins and layout unchanged.
- No SkeletonText, EmptyState or QueryStateCard introduced.
- Surrounding Card/SectionCard composition, empty, error and content states
  untouched.

Behaviour
- No query key, staleTime, retry, enabled, placeholderData, select, query
  function, mutation, permission, route or backend change.
- Story 155's `data === undefined` protection unaffected.
- No mutation pending state touched.

Primitive
- Prefer LoadingStatus. Any API addition must be driven by a demonstrated
  limitation and proven by focused tests.
```

---

## Out of scope

- Navigation, cards, visual tokens, dark mode, i18n architecture.
- Backend, API, RBAC, business logic, routing.
- Unrelated technical debt or refactoring.
