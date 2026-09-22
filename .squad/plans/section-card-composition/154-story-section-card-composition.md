# Story 154 — Section card composition

---

## Prerequisites

- **Story 139 completed** — `Card` adoption; it recorded the `CardTitle` `h3` conflict this story resolves.
- **Story 140 completed** — `PageHeader` supplies the page-level `h1` that makes `h2` the correct section level.

---

## Story Goal

Make the `Card` sub-components usable, then name the composition they exist to express.

`CardTitle` renders a fixed `h3`. The 49 section headings across both apps are `h2` under a `PageHeader` `h1`, so adopting it would skip a level. Story 139 measured that and correctly declined — leaving `CardTitle` and its four siblings at **zero** consumers while their shape was hand-written 49 times.

---

## Design decisions

### 1 — `as`, not `asChild`

The package's polymorphism convention is `asChild` (`Card`, `Button`, `Select`). It is the wrong tool here: `<CardTitle asChild><h2>Notes</h2></CardTitle>` is **longer** than the `<h2 className="text-sm font-semibold text-ink">` it replaces, so adoption would stay where Story 139 found it.

`as?: "h2" | "h3" | "h4"` picks a level without handing over the element, so the two conventions do not overlap. The union is deliberately narrow: a card title is a heading, and allowing `div` would let the outline be dropped by accident.

**Default stays `h3`** — existing callers (there are none, but the API contract holds) are unaffected.

### 2 — `SectionCard` adds no DOM node

It renders `<Card className="p-surface">` → `<CardTitle as="h2">` → children: byte-equivalent to the hand-written shape. Story 139's constraint applies unchanged — `.closest()` selectors and heading structure depend on the node count.

It is deliberately **not** built on `CardHeader`/`CardContent`, which wrap children in extra `<div>`s. That is precisely why they were never adopted.

### 3 — Bounded migration

Seven sites, both apps: `customer-detail-view.tsx` (5) and the portal's `ticket-detail-view.tsx` (2). Chosen because they are plain `<Card className="p-surface">` + `h2` with no landmark and no actions row — mechanically equivalent.

`portal-home-view.tsx` is **excluded**: its cards are `Card asChild` wrapping `<section>` landmarks, which `SectionCard` does not express. `ticket-detail-view.tsx` (web) is excluded because Story D restructures it.

---

## Implementation tasks

**File: `packages/ui/src/components/card.tsx`** — add `CardTitleLevel`, `CardTitleProps`, the `as` prop; add `SectionCard` + `SectionCardProps`.

**File: `packages/ui/src/index.ts`** — export `SectionCard` and the three new types.

**Files:** `apps/web/src/components/customers/customer-detail-view.tsx`, `apps/portal/src/components/tickets/ticket-detail-view.tsx` — migrate seven sites.

No backend changes required.

---

## Edge Cases & Failure Modes

- **A caller passes `as="div"`.** Rejected by the `CardTitleLevel` union at compile time.
- **Heading level skipped.** `portal-home-view.spec.tsx` asserts `level: 2` and is the tripwire; it is untouched by this story because its cards are excluded.
- **Extra DOM node introduced.** Would break `.closest()` selectors; asserted directly by the "adds no DOM node" test.
- **`actions` disturbs the heading.** With `actions`, the heading gains a flex wrapper row — asserted separately so the `h2` stays queryable by role.

---

## Test Plan

`packages/ui/src/components/card.spec.tsx`:

1. `CardTitle` still renders `h3` by default.
2. `CardTitle` renders the requested level (`h2`, `h4`).
3. Token classes survive at every level, with no raw palette class.
4. A caller's `className` merges rather than replacing.
5. `SectionCard` renders its title as `h2` by default.
6. `SectionCard` adds no DOM node — card's first child is the `H2`.
7. `actions` sit on the heading row without disturbing the heading.
8. `headingLevel` honoured for a nested section.
9. `elevation`/`className` pass through.
10. No physical-direction utility (RTL).

---

## Verification Steps

1. `pnpm --filter @crm/ui test` — baseline 242, expect 252.
2. `pnpm --filter @crm/web test` (1197) and `pnpm --filter @crm/portal test` (354) — unchanged.
3. `pnpm typecheck`, `pnpm lint`, `pnpm build`.

---

## Done Criteria

- [ ] `CardTitle` accepts `as` and still defaults to `h3`.
- [ ] `SectionCard` exists, defaults to `h2`, adds no DOM node.
- [ ] Seven sites migrated across both apps; no `Card asChild` site touched.
- [ ] No sub-component deleted; no `Card` visual change.
- [ ] All suites, typecheck, lint, build green.
