import { DEFAULT_PAGE_SIZE } from "./pagination-query.dto";
import type { Paginated } from "./paginated";
import { totalPagesFor } from "./paginated";

/**
 * The subset of a Prisma model delegate `paginate()` needs. A real
 * delegate (`prisma.auditLog`, ...) satisfies this structurally, so
 * nothing has to be adapted at the call site.
 */
export interface PaginatableDelegate<TWhere, TOrderBy, TRow> {
  count(args: { where: TWhere }): Promise<number>;
  findMany(args: { where: TWhere; orderBy: TOrderBy; skip: number; take: number }): Promise<TRow[]>;
}

export interface PaginateOptions<TWhere, TOrderBy> {
  /**
   * The single authoritative filter, used for BOTH queries.
   *
   * This is the reason `paginate` takes a delegate rather than two
   * caller-supplied promises. Every list query in this API composes its
   * `where` from a tenant scope plus optional filters, and several compose
   * it in ways the services themselves warn are easy to get wrong —
   * `TicketsService` documents that naively spreading two `OR` keys into
   * one object lets one clobber the other, which "would mean a
   * department-scoped search could silently drop its own branch/department
   * authorization". If a caller could hand over a `count` and a `findMany`
   * separately, the two could drift, and the symptom would be a `total`
   * that counts rows the caller is not allowed to see. Here there is only
   * one `where` and the helper issues both queries from it, so they cannot
   * disagree.
   */
  where: TWhere;
  /**
   * Ordering, including a deterministic tiebreaker.
   *
   * Offset paging over a non-unique sort column repeats rows on one page
   * and skips them on the next whenever values tie, and timestamps tie
   * routinely in bulk-written tables. Callers pass an array ending in a
   * unique column (`id`); this helper does not append one itself because
   * only the caller knows the column's name and the direction it should
   * follow.
   */
  orderBy: TOrderBy;
  /** 1-based; defaults to the first page. */
  page?: number;
  /** Defaults to `DEFAULT_PAGE_SIZE`. Bounds are enforced by
   * `PaginationQueryDto`, not re-clamped here — a value that reached this
   * function has already been validated. */
  pageSize?: number;
}

/**
 * Story S-8a — runs the count and the page fetch for one list query.
 *
 * A page past the end is not an error: it returns `items: []` with an
 * accurate `total`, `page`, `pageSize` and `totalPages`, so a client whose
 * filter just narrowed the result set gets a usable answer (and enough
 * information to correct its own page number) rather than a 404.
 *
 * The two queries run concurrently rather than inside a `$transaction`.
 * Under this database's default `READ COMMITTED` isolation each statement
 * takes its own snapshot, so wrapping them would not actually make `total`
 * and `items` agree about a concurrent insert — it would buy a
 * transaction's cost for a guarantee it cannot give. Offset paging is
 * inherently non-atomic against a table being written to; that is a
 * property of the approach, and the `desc`-first ordering these endpoints
 * use keeps the churn on page 1 rather than shifting the tail.
 */
export async function paginate<TWhere, TOrderBy, TRow>(
  delegate: PaginatableDelegate<TWhere, TOrderBy, TRow>,
  options: PaginateOptions<TWhere, TOrderBy>,
): Promise<Paginated<TRow>> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  const [total, items] = await Promise.all([
    delegate.count({ where: options.where }),
    delegate.findMany({
      where: options.where,
      orderBy: options.orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize, totalPages: totalPagesFor(total, pageSize) };
}
