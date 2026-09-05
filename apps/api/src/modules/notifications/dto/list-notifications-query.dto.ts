import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/**
 * Story S-8b — `GET /notifications` takes query parameters for the first
 * time, so this is its first DTO.
 *
 * It adds nothing of its own. The endpoint has no filters to preserve:
 * Story 36's controller comment records that it deliberately took "zero
 * query parameters", and the scope it applies (the caller's branch through
 * the `ticket` relation, plus `customerId: null`) comes from
 * `TenantContext`, never from the request. A plain subclass rather than a
 * bare `PaginationQueryDto` on the controller because the global
 * `ValidationPipe` runs with `forbidNonWhitelisted`, so this is the one
 * place a future notification filter has to be declared — and naming it
 * after the endpoint is how every other list DTO here is named.
 */
export class ListNotificationsQueryDto extends PaginationQueryDto {}
