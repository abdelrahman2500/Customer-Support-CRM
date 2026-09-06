/**
 * Story S-8c — the portal's mirror of the API's `Paginated<T>`
 * (`apps/api/src/common/pagination/paginated.ts`), matching the agent
 * workspace's own `apps/web/src/lib/paginated.ts`.
 *
 * Duplicated across the two apps rather than shared, for the same reason
 * `ticket-badges.ts` and `list-query.ts` are: there is no shared
 * domain/API-contract package, and `@crm/ui` holds presentation primitives
 * and must not take on the shape of an HTTP response.
 *
 * Field meanings are the API's: `total` counts every row matching the
 * request's filters and authorization scope regardless of page, and
 * `totalPages` floors at 1 so an empty result still reads as "page 1 of 1".
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
