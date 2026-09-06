import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/**
 * PORTAL-2 — `GET /portal/notifications` takes query parameters for the
 * first time. It adds nothing of its own: the endpoint has no filters to
 * preserve — scope is always the caller's own Customer, resolved from the
 * JWT (`PortalNotificationsController.list`), never from the request. A
 * plain subclass rather than a bare `PaginationQueryDto` on the controller
 * because the global `ValidationPipe` runs with `forbidNonWhitelisted`,
 * mirroring `ListPortalTicketsQueryDto`'s exact precedent and naming
 * convention (PORTAL-1).
 */
export class ListPortalNotificationsQueryDto extends PaginationQueryDto {}
