import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/** RM-21 — no extra filters beyond paging, mirroring
 * `ListWebhookDeliveryAttemptsQueryDto`'s own "paging is enough for now"
 * precedent. */
export class ListWebhookInboundLogsQueryDto extends PaginationQueryDto {}
