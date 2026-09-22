> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/query-state-accessibility/standardize-query-state-accessibility/intake.md`

---

## Feature

- **Feature name (display):** Query-state accessibility
- **Feature slug (folder under `plans/`):** `query-state-accessibility`

## Tracker (metadata only)

- **Work item id:** `161`
- **Labels:** ui, accessibility, design-system

---

## Title

```
Standardize query-state accessibility without forcing a visual redesign
```

---

## Premise verification (measured at HEAD de73049)

**24** complete, contiguous four-branch query-state ladders across **18** files
(count re-measured, unchanged from Story 160's recon). Of those 24:

| Property | Count |
|---|---|
| has `role="status"` | **0** |
| has `aria-busy` | **0** |
| has `aria-hidden` on the placeholder | **0** |
| renders a bare `<Skeleton>` | **24** |
| renders `SkeletonText` | **0** |

Both defects confirmed at the primitive level, not inferred:

- `Skeleton` (`packages/ui/src/components/skeleton.tsx`) is **not** `aria-hidden`
  — only `SkeletonText`, `SkeletonCard` and `RouteLoadingSkeleton` set it on a
  wrapper. So all 24 leave placeholder boxes in the accessibility tree.
- None of the 24 has any live region, so nothing is announced while a panel
  loads.

`QueryStateCard` already gets both right, and **its own spec pins both halves**
(`query-state-card.spec.tsx:19-22`): a labelled `role="status"` with
`aria-busy="true"`, and an `aria-hidden` placeholder inside it.

The error, empty and content branches are otherwise intentional and correct:
each renders `Alert variant="destructive"` with the caller's own already-
translated copy, a bespoke placeholder sized to what the panel is about to
show, and a compact `<p>` empty line rather than a dashed block.

**Two placeholder shapes** exist among the 24: a single bare `Skeleton`
(14 sites) and a `flex flex-col gap-2` stack of 2–5 bars (10 sites).

---

## Description

```
Twenty-four hand-rolled loading branches reproduce two accessibility defects
that `QueryStateCard` already solved: no live region, and placeholder boxes
left in the accessibility tree.

But that behaviour was only reachable by adopting QueryStateCard's whole
visual composition -- its SkeletonText loading shape and its dashed
EmptyState. The 24 sites deliberately use bespoke placeholders sized to the
panel they precede (a chat-height bar, three table rows, a single SLA line)
and compact paragraph empty states.

Fix the accessibility. Do not manufacture a 24-screen visual redesign to get
it.
```

---

## Acceptance criteria

```
Accessibility
- Each of the 24 loading branches exposes one labelled live region with
  aria-busy, announced once per load.
- Each placeholder is aria-hidden.
- No duplicate announcements; no announcement during a background refetch.

Visual preservation
- Placeholder markup, classes, bar counts and sizes unchanged at all 24.
- Empty states keep their existing presentation; the dashed EmptyState is NOT
  forced anywhere.
- Skeletons are NOT replaced with SkeletonText.
- Error branch copy, retry behaviour and destructive Alert semantics unchanged.
- Content rendering untouched.

Query behaviour
- No React Query config, stale time, retry, key, API call, mutation, cache or
  invalidation change.
- Story 155's `data === undefined` protection not regressed: a failed
  background refetch must not replace rendered data with an error state.

Shared primitive
- The behaviour lives in one place in @crm/ui, and QueryStateCard consumes it
  -- otherwise the extraction is wrong.
- No context, no state library, no "accessibility manager".
```

---

## Out of scope

- The 12 partial/distributed ladders.
- Redesigning empty states; mass adoption of dashed `EmptyState`.
- Replacing skeletons with `SkeletonText`.
- Changing `QueryStateCard`'s visual design.
- Navigation, cards, ticket/customer/KB detail, portal redesign.
- Backend, API, permissions, business logic, dark mode.
