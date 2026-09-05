/**
 * Story S-8b — the frontend mirror of the API's own `Paginated<T>`
 * (`apps/api/src/common/pagination/paginated.ts`).
 *
 * S-8a introduced this shape inside `audit-logs-api.ts` and noted that
 * "later stories paginating other endpoints should share one generic rather
 * than copying this shape per client file". Notifications is that second
 * endpoint, so the type moves here rather than being duplicated.
 *
 * The field meanings are the API's, not restated: `total` counts every row
 * matching the request's filters and authorization scope regardless of
 * page, and `totalPages` floors at 1 so an empty result still reads as
 * "page 1 of 1".
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
