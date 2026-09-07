import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/** RM-20 — no extra filters beyond paging: a subscription's own delivery
 * history is small enough (bounded by real traffic against it) that
 * `AuditLogsService`'s `action`/`entityType`/date-range filtering has no
 * equivalent need here yet. */
export class ListWebhookDeliveryAttemptsQueryDto extends PaginationQueryDto {}
