# Story 188 — Table v2

> CRM UI/UX redesign roadmap item **RD-1.11**. Intake: [`../../stories/table-v2/table-v2/intake.md`](../../stories/table-v2/table-v2/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §2.10, §4.2 (Table row), §6 "RD-1.11".

---

## Prerequisites

- **Story 179 completed** (`bac28a3`, RD-1.2): `text-label`, the `rounded-*` scale, `duration-fast`, and `cn` registration of every named scale.
- **Story 185 completed** (`7efabea`, RD-1.8): `Button` `size="icon-sm"` (32px square), used by Pagination below.
- **Story 187 completed** (`6fe4791`, RD-1.10): surface tokens for raised and card surfaces. Precedent for shape and tone: [`../surfaces-and-overlays/187-story-surfaces-and-overlays.md`](../surfaces-and-overlays/187-story-surfaces-and-overlays.md).
- Shared contract: `packages/ui` is consumed by `apps/web` and `apps/portal` and stays **translation-free**; every label arrives as a prop or child.

---

## Story Goal

Give the shared `Table` the design language's density, interaction states and a reusable sortable header, and refresh `Pagination`. No list may change what it shows, how it sorts, or its URL state.

1. `Table` takes `density="compact" | "comfortable"`. **`compact` is the default and reproduces today's padding exactly**, so no existing table changes size in this Story.
2. Row hover becomes visible on the page canvas, using `surface-muted` instead of the canvas-coloured `surface-sunk`. A row can be marked selected with a token tint.
3. Header and mobile cell labels drop `uppercase tracking-wide` (meaningless in Arabic, and it breaks letter-joining) and use `text-label`.
4. Mobile card rows use the token radius and surface.
5. A new exported `TableSortHead` replaces the four hand-rolled sortable headers in the ticket and customer lists.
6. Pagination gets square icon buttons and a tabular page indicator; its API is unchanged.

**Not in scope:** a mobile sort control or ListToolbar (RD-4.1), opting any screen into `comfortable` (Phase 4/6), column changes, bulk-selection UI, any new dependency, and any backend, API, database, auth or routing change.

**Reconciliation with the intake:** the intake says `selected` "sets aria-selected". `aria-selected` is only defined for rows inside `role="grid"`/`"treegrid"`, and none of this repo's tables use those roles, so setting it there would be meaningless. In this Plan, `selected` is **visual** (a `data-selected` attribute plus the tint), and `TableRow` keeps forwarding any `aria-selected` a caller passes in a grid context.

---

## Context — Read These Files First

1. `packages/ui/src/components/table.tsx`:
   - `TableCellProps`, ~lines 32–39
   - `Table`, ~41–47: the `overflow-x-auto` wrapper, and `block … sm:table` on the `<table>`
   - `TableHeader`, ~49–59: hidden below `sm`
   - `TableBody`, ~61–71
   - `TableRow`, ~73–83: the mobile card is `flex flex-col gap-2 rounded-md border border-rule p-3`; from `sm` it is a table row with `sm:hover:bg-surface-sunk`
   - `TableHead`, ~85–95: `hidden h-10 px-3 text-start align-middle text-xs font-medium uppercase tracking-wide text-ink-subtle sm:table-cell`
   - `TableCell`, ~97–114: `px-3 py-2`, with the mobile `label` span at ~107 using `text-xs font-medium uppercase tracking-wide text-ink-subtle sm:hidden`
2. `packages/ui/src/components/sort-indicator.tsx` — `SortDirection` and `SortIndicator` (`direction`, `showInactive`; renders nothing when inactive; carries `ms-1`).
3. `packages/ui/src/components/pagination.tsx` — `Pagination` (~line 57), the live indicator `<span aria-live="polite" className="text-xs text-ink-muted">` (~85), and two `Button variant="outline" size="sm"` icon buttons (~90–110) with `aria-label`s and the `rtl:rotate-180` chevrons.
4. `packages/ui/src/index.ts`:
   - SortIndicator exports, ~lines 106–107
   - Pagination exports, ~155–156
   - Table exports, ~245–246: `export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./components/table";` plus `TableCellProps`
5. `apps/web/src/components/tickets/ticket-list-view.tsx`:
   - `sortAriaValue`, ~lines 40–55 (doc + function)
   - `toggleSort`, ~206–215
   - the two hand-rolled sortable `TableHead`s (createdAt, updatedAt), ~333–356
   - the `@crm/ui` import block, which includes `SortIndicator`
6. `apps/web/src/components/customers/customer-list-view.tsx`:
   - `sortAriaValue`, ~lines 40–53
   - `toggleSort`, ~138
   - the hand-rolled sortable `TableHead`s (displayName, createdAt), ~233–258
   - `SortIndicator` in the import block, ~line 21
7. Specs:
   - `packages/ui/src/components/table.spec.tsx`: the mobile-card test, ~104–122, pins `rounded-md`; other tests ~17–200 must stay green
   - `packages/ui/src/components/pagination.spec.tsx`
   - `packages/ui/src/components/sort-indicator.spec.tsx`
   - `apps/web/src/components/tickets/ticket-list-view.spec.tsx`: sort tests ~576–661, aria-sort test ~592–610
   - `apps/web/src/components/customers/customer-list-view.spec.tsx`
   - the guard `apps/web/src/test/table-mobile-labels.spec.ts`, which must pass unchanged
- Grep for `aria-sort` in `apps/web/src` and `apps/portal/src` (non-spec): only the four headers above.

---

## Product rules (from story)

| Element | Before | After |
|---|---|---|
| Table padding | head `h-10 px-3`, cell `px-3 py-2` | `density="compact"` (default) = same; `comfortable` = head `h-11 px-4`, cell `px-4 py-3` |
| Row hover (≥ sm) | `sm:hover:bg-surface-sunk` (invisible on canvas) | `sm:hover:bg-surface-muted` |
| Selected row | — | `selected` → `data-selected="true"` + `bg-accent-surface` |
| Header / mobile label | `text-xs font-medium uppercase tracking-wide` | `text-label` (no uppercase, no tracking) |
| Mobile card row | `rounded-md border border-rule p-3` | `rounded-surface border border-rule bg-surface p-3` (transparent from `sm`) |
| Sortable header | hand-rolled `<th aria-sort><button class="rounded-sm hover:underline focus-ring">` ×4 | `<TableSortHead direction onSort>` |
| Pagination | `size="sm"` outline buttons, `text-xs` indicator | `size="icon-sm"` outline buttons, `text-caption tabular-nums` indicator |

---

## Frontend Tasks

No backend changes required.

### 1 — Table density, row states, labels

**File: `packages/ui/src/components/table.tsx`**

Add density context and tables, with **compact first and the default**:

```tsx
export type TableDensity = "compact" | "comfortable";

const TableDensityContext = React.createContext<TableDensity>("compact");

/** Story 188 — compact is today's exact padding; comfortable is roadmap §2.10's ~48px row. */
const HEAD_DENSITY: Record<TableDensity, string> = {
  compact: "h-10 px-3",
  comfortable: "h-11 px-4",
};
const CELL_DENSITY: Record<TableDensity, string> = {
  compact: "px-3 py-2",
  comfortable: "px-4 py-3",
};

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
}
```

**`Table`:** destructure `density = "compact"`, wrap the existing markup in `<TableDensityContext.Provider value={density}>`, and add `data-density={density}` to the `<table>`. Keep the wrapper div and the `block w-full text-start text-sm sm:table` classes exactly.

**`TableRow`:** accept `selected?: boolean`. Render `data-selected={selected ? "true" : undefined}` and forward all other props, including any caller `aria-selected`. Replace the class string with:

```tsx
"flex flex-col gap-2 rounded-surface border border-rule bg-surface p-3 transition-colors duration-fast data-[selected=true]:bg-accent-surface sm:table-row sm:flex-row sm:gap-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:hover:bg-surface-muted sm:data-[selected=true]:bg-accent-surface"
```

Export `TableRowProps` (`React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }`).

**`TableHead`:** read the context and use:

```tsx
cn("hidden text-start align-middle text-label text-ink-subtle sm:table-cell", HEAD_DENSITY[density], className)
```

**`TableCell`:** read the context. Use:

```tsx
cn("flex items-center justify-between gap-3 align-middle sm:table-cell sm:justify-normal", CELL_DENSITY[density], className)
```

and change the mobile label span to `"shrink-0 text-label text-ink-subtle sm:hidden"`.

Update the file's doc comments where they quote the old classes, with a Story 188 note on: density (compact = today), hover on `surface-muted` (visible on the canvas), and no uppercase (Arabic).

### 2 — TableSortHead

**File: `packages/ui/src/components/table.tsx`** (same file, after `TableHead`), importing `SortIndicator` and `SortDirection` from `./sort-indicator`:

```tsx
export interface TableSortHeadProps
  extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "onClick" | "aria-sort"> {
  /** The column's current direction, or null/undefined when another column is sorted. */
  direction: SortDirection | null | undefined;
  /** Called when the header button is activated; the caller owns the toggle logic. */
  onSort: () => void;
  children: React.ReactNode;
}

export function TableSortHead({ direction, onSort, children, ...props }: TableSortHeadProps) {
  const ariaSort = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
  return (
    <TableHead aria-sort={ariaSort} {...props}>
      <button type="button" className="focus-ring rounded-inner hover:underline" onClick={onSort}>
        {children}
        <SortIndicator direction={direction ?? null} />
      </button>
    </TableHead>
  );
}
```

`aria-sort` values and the button markup must match today's hand-rolled headers. The `aria-sort` mapping is equivalent to both lists' `sortAriaValue` helpers.

**File: `packages/ui/src/index.ts`** (~245–246): export `TableSortHead` with the table components, and the types `TableDensity`, `TableProps`, `TableRowProps`, `TableSortHeadProps` alongside `TableCellProps`.

### 3 — Adopt TableSortHead in the two lists

**File: `apps/web/src/components/tickets/ticket-list-view.tsx`** (~333–356). Replace each sortable header with:

```tsx
<TableSortHead
  direction={filters.sortBy === "createdAt" ? filters.sortDir : null}
  onSort={() => toggleSort("createdAt")}
>
  {t("list.columns.createdAt")}
</TableSortHead>
```

Do the same for `updatedAt`. Then delete `sortAriaValue` and its doc comment (~40–55), since it is now unused. Swap `SortIndicator` for `TableSortHead` in the `@crm/ui` import. **Do not** change `toggleSort`, the filters or the URL mapping.

**File: `apps/web/src/components/customers/customer-list-view.tsx`** (~233–258): same change for `displayName` and `createdAt`. Delete its `sortAriaValue` (~40–53) and swap the import. **Do not** change `toggleSort` (~138).

If either file still uses `SortIndicator` elsewhere after the change, keep that import.

### 4 — Pagination refresh

**File: `packages/ui/src/components/pagination.tsx`:**
- The indicator span (~85) becomes `className="text-caption tabular-nums text-ink-muted"`. Keep `aria-live="polite"`.
- Both buttons (~90–110) become `size="icon-sm"`. Keep `variant="outline"`, `aria-label`, `disabled` and the `rtl:rotate-180` chevrons.

No prop or behaviour change.

---

## Edge Cases & Failure Modes

- **Existing tables must not change size.** Every current `<Table>` passes no `density`, so the context default `compact` yields the old `h-10 px-3` and `px-3 py-2`. Enforced by the default in `Table`; asserted in the Test Plan.
- **`TableHead`/`TableCell` rendered outside a `Table`** (unlikely, but legal in tests): the context default is `compact`, the same as today.
- **Caller `className` overrides** (for example `text-end` on a cell, or the ticket list's `align-top` and widths): `cn` merges the caller's classes last, as today. The existing `table.spec.tsx` (~187–198) protects this.
- **Hover on the mobile card.** The hover tint applies only from `sm` (`sm:hover:`), as before, because a touch card has no hover.
- **Selected on mobile.** `data-[selected=true]:bg-accent-surface` applies in both layouts. On a raised card, `accent-surface` contrasts with text through `ink`, which is guarded by the token-contrast spec (`ink-subtle` on `accent-surface` ≥ 4.5 in both themes).
- **`text-label` in Arabic.** The `:lang(ar) .text-label` reset in `packages/config/tailwind-tokens.css` (Story 179) removes letter-spacing, and there is no `uppercase` left to apply.
- **Sort state when another column is sorted.** `direction={null}` gives `aria-sort="none"` and no indicator (`SortIndicator` returns null), the same as today.
- **`aria-sort` on a `<th>` hidden below `sm`.** Unchanged behaviour: the whole header is hidden below `sm` (RD-4.1 adds the mobile sort control).
- **Pagination at 320px.** `icon-sm` (32px) equals today's `sm` height (32px) and is narrower, so no new overflow.
- **Unused-variable lint.** Removing `sortAriaValue` and `SortIndicator` imports must leave none unused; `pnpm --filter @crm/web lint` enforces this.

---

## Test Plan

1. **Modify** `packages/ui/src/components/table.spec.tsx` (~104–122): the mobile-card assertion changes `rounded-md` to `rounded-surface` (the token radius; intent unchanged). Add `bg-surface` and `sm:bg-transparent` to the same assertion.
2. **Extend** `packages/ui/src/components/table.spec.tsx` with:
   - with no `density`, a head has `h-10 px-3` and a cell has `px-3 py-2` (today's padding);
   - `density="comfortable"` gives `h-11 px-4` and `px-4 py-3`, and the `<table>` has `data-density`;
   - `TableHead` has `text-label` and no `uppercase`/`tracking-wide`; the mobile label likewise;
   - `TableRow` has `sm:hover:bg-surface-muted`; `selected` sets `data-selected="true"` and the `bg-accent-surface` class; a caller `aria-selected` is forwarded;
   - `TableSortHead`: `direction="asc"` gives `aria-sort="ascending"`, `"desc"` gives `"descending"`, and `null` gives `"none"` with no svg indicator; clicking the button calls `onSort` once; the header's accessible name is the children text.
3. **Extend** `packages/ui/src/components/pagination.spec.tsx`: the buttons have `h-8 w-8` (icon-sm) and keep their `aria-label`s; the indicator has `tabular-nums` and `aria-live="polite"`.
4. **Unchanged, must pass:**
   - the sort and aria-sort tests in `apps/web/src/components/tickets/ticket-list-view.spec.tsx` (~576–661) and `customers/customer-list-view.spec.tsx`
   - `apps/web/src/test/table-mobile-labels.spec.ts`
   - `apps/web/src/test/style-guard.spec.ts`
   - every other web and portal spec
5. If an app spec pins `uppercase`, `rounded-md` on a table row, or a pagination size class, update it to the new token with its intent preserved, and list it in the completion report. Otherwise fix the implementation.

---

## Verification Steps

1. **Unit (sequential):** `pnpm --filter @crm/ui test`, then `pnpm --filter @crm/web test`, then `pnpm --filter @crm/portal test`.
2. **Static:** `pnpm --filter @crm/ui typecheck`, `@crm/web typecheck`, `@crm/portal typecheck`, `@crm/ui lint`, `@crm/web lint`, `@crm/portal lint`.
3. **Builds:** stop any server using `apps/*/.next`, then run `pnpm --filter @crm/web build` and `pnpm --filter @crm/portal build`.
4. **Frontend runs:** with the API and production servers running, capture the ticket list and the customer list at 320 / 768 / 1280 × en / ar × light / dark. Confirm:
   - padding is unchanged (compact);
   - headers are not uppercase;
   - hover is visible on the canvas;
   - sort buttons work by keyboard with a visible focus ring;
   - Arabic headers render without letter-spacing;
   - tables stack to cards below `sm`;
   - no new horizontal overflow.

   Activate a sort header and confirm the URL and `aria-sort` update as before.
5. **Regression:** run `git diff --check`, review the complete diff, and confirm only the files named here (plus specs, intake, plan, overview and index) changed. `qa-review.md` and `stash@{0}` must be untouched.

---

## Done Criteria

- [ ] `Table` `density` prop; compact (default) reproduces `h-10 px-3` / `px-3 py-2`; comfortable gives `h-11 px-4` / `px-4 py-3`.
- [ ] Row hover is `surface-muted`; `selected` gives `data-selected` + `bg-accent-surface`; a caller `aria-selected` is forwarded.
- [ ] Header and mobile labels use `text-label` with no `uppercase`/`tracking-wide`.
- [ ] Mobile card rows use `rounded-surface` and `bg-surface` (transparent from `sm`).
- [ ] `TableSortHead` is exported; its `aria-sort` mapping and button behaviour are specced.
- [ ] The ticket and customer lists use `TableSortHead` for all four sortable columns; the `sortAriaValue` helpers are removed; the sort, URL and aria-sort specs pass unchanged.
- [ ] Pagination uses `icon-sm` buttons and a `tabular-nums` indicator, with the same API.
- [ ] `table-mobile-labels.spec.ts` and the style guard pass unchanged.
- [ ] ui, web and portal tests, typecheck and lint pass; both production builds pass.
- [ ] Visual matrix shows no new overflow; Arabic headers have no letter-spacing.
- [ ] No backend, API, database, auth or routing change; no new dependency.
