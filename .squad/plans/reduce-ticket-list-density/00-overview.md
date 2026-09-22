# reduce-ticket-list-density — plan overview

| NN  | Title | Depends on |
|-----|-------|------------|
| 158 | Reduce ticket list density | 153 (localized status/priority labels) |

## Change

Ten columns → eight. `id` and `category` folded into the subject cell as a secondary line; both stay visible and stay readable on the mobile card.

## Why those two, and not the dates

`createdAt` and `updatedAt` look like the obvious cuts, but their `<TableHead>`s carry the sort controls (`aria-sort` + `SortIndicator`). Removing either column removes the only way to sort by it, and the brief protects sorting semantics. So the columns that went are the two with no sort control and the least scanning value: the id is an opaque 8-character hash, and the category already has its own filter directly above the table.

## Preserved

Filtering, sorting, pagination, API contracts, the `Table` primitive, and Story 150's mobile labels — the remaining eight cells keep their `label` props and the guard spec passes unchanged.
