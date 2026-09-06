import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/**
 * PORTAL-1 — `GET /portal/tickets` takes query parameters for the first
 * time. It adds nothing of its own: the endpoint has no filters to
 * preserve — scope is always the caller's own Customer, resolved from the
 * JWT (`PortalTicketsController.list`), never from the request — and
 * ordering is fixed (see `TicketsService.listTicketsForCustomer`'s own doc
 * comment). A plain subclass rather than a bare `PaginationQueryDto` on the
 * controller because the global `ValidationPipe` runs with
 * `forbidNonWhitelisted`, so this is the one place a future "my tickets"
 * filter would have to be declared — mirrors `ListNotificationsQueryDto`'s
 * exact precedent and naming convention.
 */
export class ListPortalTicketsQueryDto extends PaginationQueryDto {}
