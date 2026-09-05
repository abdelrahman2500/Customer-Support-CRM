/**
 * Story S-8a — the envelope every paginated list endpoint returns.
 *
 * `total` is the count of rows matching the request's filters and
 * authorization scope, ignoring `page`/`pageSize`. It is therefore
 * authorization-visible data: a `total` computed from a wider `where` than
 * `items` would disclose how many rows exist that the caller may not read.
 * `paginate()` exists to make that mistake unrepresentable — see its doc
 * comment.
 *
 * `page` and `pageSize` are echoed back so a client never has to remember
 * what it asked for, and so a defaulted request is self-describing.
 *
 * `totalPages` is a floor of 1, not 0, for an empty result. A UI that shows
 * "page 1 of 1" over an empty table reads correctly; "page 1 of 0" does
 * not, and every caller would otherwise have to special-case it.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** `total / pageSize`, rounded up, never below 1. */
export function totalPagesFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
